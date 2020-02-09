import BigNumber from "bignumber.js";
import Binance, {
  AvgPriceResult,
  ExecutionReport,
  Message,
  NewOrder,
  Order,
  SymbolLotSizeFilter,
  SymbolMinNotionalFilter,
  SymbolPercentPriceFilter,
  SymbolPriceFilter,
  Trade
} from "binance-api-node";
import * as Joi from "joi";

const debug = require("debug")("binance-oco");

const schema = Joi.object()
  .keys({
    pair: Joi.string()
      .uppercase()
      .required(),
    amount: Joi.number()
      .positive()
      .required(),
    buyPrice: Joi.number().min(0),
    buyLimitPrice: Joi.number().positive(),
    cancelPrice: Joi.number().positive(),
    stopPrice: Joi.number()
      .positive()
      .when("buyPrice", {
        is: Joi.number()
          .greater(0)
          .required(),
        then: Joi.number().less(Joi.ref("buyPrice"))
      }),
    stopLimitPrice: Joi.number().positive(),
    targetPrice: Joi.number()
      .positive()
      .when("stopPrice", {
        is: Joi.required(),
        then: Joi.number().greater(Joi.ref("stopPrice"))
      })
      .when("buyPrice", {
        is: Joi.required(),
        then: Joi.number().greater(Joi.ref("buyPrice"))
      }),
    scaleOutAmount: Joi.number()
      .less(Joi.ref("amount"))
      .positive(),
    nonBnbFees: Joi.boolean()
  })
  .or("buyPrice", "stopPrice", "targetPrice")
  .with("buyLimitPrice", "buyPrice")
  .with("cancelPrice", "buyPrice")
  .with("stopLimitPrice", "stopPrice")
  .with("scaleOutAmount", "targetPrice");

export const binanceOco = async (
  options: {
    pair: string;
    amount: string;
    buyPrice?: string;
    buyLimitPrice?: string;
    cancelPrice?: string;
    stopPrice?: string;
    stopLimitPrice?: string;
    targetPrice?: string;
    scaleOutAmount?: string;
    nonBnbFees?: boolean;
  },
  exitHook?: Function
): Promise<void> => {
  const result = Joi.validate(options, schema);
  if (result.error !== null) {
    throw result.error;
  }

  const { pair, cancelPrice, nonBnbFees } = options;

  let {
    amount,
    buyPrice,
    buyLimitPrice,
    stopPrice,
    stopLimitPrice,
    targetPrice,
    scaleOutAmount
  } = options;

  const binance = Binance({
    apiKey: process.env.APIKEY || "",
    apiSecret: process.env.APISECRET || ""
  });

  let isCancelling = false;

  const cancelOrderAsync = async (
    symbol: string,
    orderId: number
  ): Promise<void> => {
    if (!isCancelling) {
      isCancelling = true;
      try {
        const response = await binance.cancelOrder({ symbol, orderId });

        debug("Cancel response: %o", response);
        debug(`order id: ${response.orderId}`);
      } catch (err) {
        debug(`${symbol} cancel error:`, err.body);
      } finally {
        isCancelling = false;
      }
    }
  };

  const placeStopOrderAsync = async (orderAmount: string): Promise<number> => {
    try {
      const response = await binance.order({
        symbol: pair,
        side: "SELL",
        quantity: orderAmount,
        price: stopLimitPrice || stopPrice,
        stopPrice,
        type: "STOP_LOSS_LIMIT",
        newOrderRespType: "FULL"
      });

      debug("Sell response: %o", response);
      debug(`order id: ${response.orderId}`);

      return response.orderId;
    } catch (err) {
      throw err;
    }
  };

  const placeTargetOrderAsync = async (
    orderAmount: string
  ): Promise<number> => {
    try {
      const response = await binance.order({
        symbol: pair,
        side: "SELL",
        quantity: orderAmount,
        price: targetPrice,
        type: "LIMIT"
      });

      debug("Sell response: %o", response);
      debug(`order id: ${response.orderId}`);

      return response.orderId;
    } catch (err) {
      throw err;
    }
  };

  const placeOcoOrderAsync = async (orderAmount: string): Promise<number> => {
    try {
      const response = await binance.orderOco({
        symbol: pair,
        side: "SELL",
        quantity: orderAmount,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        price: targetPrice!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        stopPrice: stopPrice!,
        stopLimitPrice: stopLimitPrice || stopPrice
      });

      debug("Sell response: %o", response);
      debug(`order list id: ${response.orderListId}`);

      return response.orderListId;
    } catch (err) {
      throw err;
    }
  };

  const isOrderFilled = (data: ExecutionReport): boolean => {
    const {
      symbol,
      priceLastTrade,
      lastTradeQuantity,
      totalTradeQuantity,
      side,
      orderType,
      orderId,
      orderStatus
    } = data;

    debug(`${symbol} ${side} ${orderType} ORDER #${orderId} (${orderStatus})`);
    debug(
      `..last price: ${priceLastTrade}, last trade quantity: ${lastTradeQuantity}, total trade quantity: ${totalTradeQuantity}`
    );

    if (orderStatus === "NEW" || orderStatus === "PARTIALLY_FILLED") {
      return false;
    }

    if (orderStatus !== "FILLED") {
      throw new Error(
        `Order ${orderStatus}. Reason: ${data.orderRejectReason}`
      );
    }

    return true;
  };

  let disconnect;
  let stopSellAmount: string;
  let targetSellAmount: string;
  let isLimitEntry = false;
  let isStopEntry = false;

  const waitForBuyOrderFill = (buyOrderId: number): Promise<string> => {
    return new Promise(
      (resolve, reject): void => {
        try {
          disconnect = binance.ws.trades(
            pair,
            async (trade: Trade): Promise<void> => {
              try {
                const { symbol, price } = trade;
                if (!cancelPrice) {
                  debug(
                    `${symbol} trade update. price: ${price} buy: ${buyPrice}`
                  );
                } else {
                  debug(
                    `${symbol} trade update. price: ${price} buy: ${buyPrice} cancel: ${cancelPrice}`
                  );

                  if (
                    ((isStopEntry && new BigNumber(price).lte(cancelPrice)) ||
                      (isLimitEntry &&
                        new BigNumber(price).gte(cancelPrice))) &&
                    !isCancelling
                  ) {
                    await cancelOrderAsync(symbol, buyOrderId);
                    reject(
                      new Error(
                        `Order CANCELED. Reason: cancel price ${cancelPrice} hit`
                      )
                    );
                  }
                }
              } catch (err) {
                reject(err);
              }
            }
          );

          binance.ws.user(
            (msg: Message): void => {
              try {
                if (msg.eventType !== "executionReport") return;
                const executionReport = msg as ExecutionReport;
                const { orderId } = executionReport;
                if (orderId === buyOrderId && isOrderFilled(executionReport)) {
                  const { commissionAsset } = executionReport;
                  resolve(commissionAsset);
                }
              } catch (err) {
                reject(err);
              }
            }
          );

          binance
            .getOrder({
              symbol: pair,
              orderId: buyOrderId
            })
            .then(
              (response): void => {
                if (response.status === "FILLED") {
                  // Binance API doesn't provide commission asset information; default to BNB
                  resolve("BNB");
                }
              }
            );
        } catch (err) {
          reject(err);
        }
      }
    );
  };

  const round = (toBeRounded: BigNumber, toNearest: string): string => {
    const fractionDigits = Math.max(toNearest.indexOf("1") - 1, 0);
    return toBeRounded.toFixed(fractionDigits, BigNumber.ROUND_DOWN);
  };

  const adjustSellAmountsForCommission = async (
    commissionAsset: string,
    stepSize: string
  ): Promise<void> => {
    if (commissionAsset !== "BNB" || nonBnbFees) {
      try {
        const tradeFee = (await binance.tradeFee()).tradeFee.find(
          (ei: { symbol: string }): boolean => ei.symbol === pair
        );
        if (tradeFee) {
          stopSellAmount = round(
            new BigNumber(stopSellAmount).times(1 - tradeFee.maker),
            stepSize
          );
          targetSellAmount = round(
            new BigNumber(targetSellAmount).times(1 - tradeFee.maker),
            stepSize
          );
        }
      } catch (err) {
        debug(`Could not pull trade fee for ${pair}: ${err.body}`);
        throw err;
      }
    }
  };

  const getAveragePrice = async (pair: string): Promise<string> => {
    const result = await binance.avgPrice({ symbol: pair });
    return (result as AvgPriceResult).price
      ? (result as AvgPriceResult).price
      : (result as AvgPriceResult[])[0].price;
  };

  const symbolData = (await binance.exchangeInfo()).symbols.find(
    (ei: { symbol: string }): boolean => ei.symbol === pair
  );
  if (!symbolData) {
    throw new Error(`Could not pull exchange info for ${pair}`);
  }

  const { filters } = symbolData;
  const { stepSize } = filters.find(
    (eis: { filterType: string }): boolean => eis.filterType === "LOT_SIZE"
  ) as SymbolLotSizeFilter;
  const { tickSize, minPrice } = filters.find(
    (eis: { filterType: string }): boolean => eis.filterType === "PRICE_FILTER"
  ) as SymbolPriceFilter;
  const { minNotional } = filters.find(
    (eis: { filterType: string }): boolean => eis.filterType === "MIN_NOTIONAL"
  ) as SymbolMinNotionalFilter;

  amount = round(new BigNumber(amount), stepSize);

  if (scaleOutAmount) {
    scaleOutAmount = round(new BigNumber(scaleOutAmount), stepSize);
  }

  stopSellAmount = amount;
  targetSellAmount = scaleOutAmount || amount;

  if (buyPrice) {
    buyPrice = round(new BigNumber(buyPrice), tickSize);

    if (buyLimitPrice) {
      buyLimitPrice = round(new BigNumber(buyLimitPrice), tickSize);
    } else {
      const accountInfo = await binance.accountInfo();
      const { quoteAsset } = symbolData;
      const accountBalance = accountInfo.balances.find(
        (ab: { asset: string }): boolean => ab.asset === quoteAsset
      );
      const available = accountBalance ? accountBalance.free : "";
      const maxAvailablePrice = new BigNumber(available).div(amount).toNumber();

      const currentPrice = await getAveragePrice(pair);
      const { multiplierUp } = filters.find(
        (eis: { filterType: string }): boolean =>
          eis.filterType === "PERCENT_PRICE"
      ) as SymbolPercentPriceFilter;
      const maxPercentPrice = new BigNumber(currentPrice)
        .times(multiplierUp)
        .toNumber();

      buyLimitPrice = round(
        BigNumber.min(maxAvailablePrice, maxPercentPrice).minus(tickSize),
        tickSize
      );
    }
  }

  if (stopPrice) {
    stopPrice = round(new BigNumber(stopPrice), tickSize);

    const minStopSellAmount = new BigNumber(stopSellAmount)
      .minus(targetSellAmount)
      .isZero()
      ? stopSellAmount
      : round(
          BigNumber.min(
            targetSellAmount,
            new BigNumber(stopSellAmount).minus(targetSellAmount)
          ),
          stepSize
        );

    if (stopLimitPrice) {
      stopLimitPrice = round(new BigNumber(stopLimitPrice), tickSize);
    } else {
      const currentPrice = await getAveragePrice(pair);
      const { multiplierDown } = filters.find(
        (eis: { filterType: string }): boolean =>
          eis.filterType === "PERCENT_PRICE"
      ) as SymbolPercentPriceFilter;
      const minPercentPrice = new BigNumber(currentPrice).times(multiplierDown);
      const minNotionalPrice = new BigNumber(minNotional).div(
        minStopSellAmount
      );

      stopLimitPrice = round(
        BigNumber.max(minPrice, minPercentPrice, minNotionalPrice).plus(
          tickSize
        ),
        tickSize
      );
    }

    if (buyPrice || targetPrice) {
      const order: NewOrder = {
        symbol: pair,
        side: "SELL",
        quantity: minStopSellAmount,
        price: stopLimitPrice,
        stopPrice,
        type: "STOP_LOSS_LIMIT"
      };
      debug("Validating stop order: %o", order);
      await binance.orderTest(order);
      debug("Stop order valid");
    }
  }

  if (targetPrice) {
    targetPrice = round(new BigNumber(targetPrice), tickSize);
    if (buyPrice || stopPrice) {
      const order: NewOrder = {
        symbol: pair,
        side: "SELL",
        quantity: targetSellAmount,
        price: targetPrice,
        type: "LIMIT"
      };
      debug("Validating target order: %o", order);
      await binance.orderTest(order);
      debug("Target order valid");
    }
  }

  if (typeof buyPrice !== "undefined" && new BigNumber(buyPrice).gte(0)) {
    let response: Order | undefined;
    try {
      if (new BigNumber(buyPrice).isZero()) {
        response = await binance.order({
          symbol: pair,
          side: "BUY",
          quantity: amount,
          type: "MARKET"
        });
      } else if (new BigNumber(buyPrice).gt(0)) {
        const prices = await binance.prices();
        const currentPrice = prices[pair];
        debug(`${pair} price: ${currentPrice}`);

        if (new BigNumber(buyPrice).gt(currentPrice)) {
          isStopEntry = true;
          response = await binance.order({
            symbol: pair,
            side: "BUY",
            quantity: amount,
            price: buyLimitPrice || buyPrice,
            stopPrice: buyPrice,
            type: "STOP_LOSS_LIMIT",
            newOrderRespType: "FULL"
          });
        } else {
          isLimitEntry = true;
          response = await binance.order({
            symbol: pair,
            side: "BUY",
            quantity: amount,
            price: buyPrice,
            type: "LIMIT"
          });
        }
      }
    } catch (err) {
      throw err;
    }

    if (response) {
      debug("Buy response: %o", response);
      debug(`order id: ${response.orderId}`);

      let orderFilled = response.status == "FILLED";
      // Exit hook to safely cancel order
      if (exitHook) {
        exitHook(
          async (): Promise<void> => {
            debug("Exit hook fired");
            var order = response as Order;
            if (order) {
              if (!orderFilled) {
                await cancelOrderAsync(pair, order.orderId);
              }
            }
          }
        );
      }

      let commissionAsset = "";
      if (response.status !== "FILLED") {
        commissionAsset = await waitForBuyOrderFill(response.orderId).finally(
          disconnect
        );
      } else if (response.fills && response.fills.length > 0) {
        commissionAsset = response.fills[0].commissionAsset;
      }
      orderFilled = true;

      if (stopPrice || targetPrice) {
        await adjustSellAmountsForCommission(commissionAsset, stepSize);
      }
    }
  }

  if (stopPrice && targetPrice) {
    if (new BigNumber(targetSellAmount).lt(stopSellAmount)) {
      await placeStopOrderAsync(
        round(new BigNumber(stopSellAmount).minus(targetSellAmount), stepSize)
      );
      stopSellAmount = targetSellAmount;
    }

    await placeOcoOrderAsync(stopSellAmount);
  } else if (stopPrice && !targetPrice) {
    await placeStopOrderAsync(stopSellAmount);
  } else if (!stopPrice && targetPrice) {
    await placeTargetOrderAsync(targetSellAmount);
  }
};
