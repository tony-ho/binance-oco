const debug = require('debug')('binance-oco');
const Joi = require('joi');
const BigNumber = require('bignumber.js');
const Binance = require('./lib/node-binance-api-async');

const schema = Joi.object().keys({
  pair: Joi.string().uppercase().required(),
  amount: Joi.number().positive().required(),
  buyPrice: Joi.number().min(0),
  buyLimitPrice: Joi.number().positive(),
  cancelPrice: Joi.number().positive(),
  stopPrice: Joi.number().positive()
    .when('buyPrice', {
      is: Joi.number().greater(0).required(),
      then: Joi.number().less(Joi.ref('buyPrice')),
    }),
  stopLimitPrice: Joi.number().positive(),
  targetPrice: Joi.number().positive()
    .when('stopPrice', {
      is: Joi.required(),
      then: Joi.number().greater(Joi.ref('stopPrice')),
    })
    .when('buyPrice', {
      is: Joi.required(),
      then: Joi.number().greater(Joi.ref('buyPrice')),
    }),
  scaleOutAmount: Joi.number().less(Joi.ref('amount')).positive(),
  nonBnbFees: Joi.boolean(),
}).or('buyPrice', 'stopPrice', 'targetPrice')
  .with('buyLimitPrice', 'buyPrice')
  .with('cancelPrice', 'buyPrice')
  .with('stopLimitPrice', 'stopPrice')
  .with('scaleOutAmount', 'targetPrice');

const binanceOco = async (options) => {
  const result = Joi.validate(options, schema);
  if (result.error !== null) {
    throw new Error(result.error);
  }

  const {
    pair,
    cancelPrice,
    nonBnbFees,
  } = options;

  let {
    amount, buyPrice, buyLimitPrice, stopPrice, stopLimitPrice, targetPrice,
    scaleOutAmount,
  } = options;

  const binance = new Binance();

  const disconnect = () => {
    const endpoints = binance.websockets.subscriptions();
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const endpoint in endpoints) {
      binance.websockets.terminate(endpoint);
    }
  };

  let isCancelling = false;

  const cancelOrderAsync = async (symbol, orderId) => {
    if (!isCancelling) {
      isCancelling = true;
      try {
        const response = await binance.cancelAsync(symbol, orderId);

        debug('Cancel response: %o', response);
        debug(`order id: ${response.orderId}`);
      } catch (err) {
        debug(`${symbol} cancel error:`, err.body);
      } finally {
        isCancelling = false;
      }
    }
  };

  const placeStopOrderAsync = async (orderAmount) => {
    try {
      const response = await binance.sellAsync(pair, orderAmount, stopLimitPrice || stopPrice, { stopPrice, type: 'STOP_LOSS_LIMIT', newOrderRespType: 'FULL' });

      debug('Sell response: %o', response);
      debug(`order id: ${response.orderId}`);

      return response.orderId;
    } catch (err) {
      throw new Error(err.body);
    }
  };

  const placeTargetOrderAsync = async (orderAmount) => {
    try {
      const response = await binance.sellAsync(pair, orderAmount, targetPrice, { type: 'LIMIT', newOrderRespType: 'FULL' });

      debug('Sell response: %o', response);
      debug(`order id: ${response.orderId}`);

      return response.orderId;
    } catch (err) {
      throw new Error(err.body);
    }
  };

  const isOrderFilled = (data) => {
    const {
      s: symbol, L: lastExecutedPrice, l: lastExecutedQuantity, z: filledQuantity, S: side,
      o: orderType, i: orderId, X: orderStatus,
    } = data;

    debug(`${symbol} ${side} ${orderType} ORDER #${orderId} (${orderStatus})`);
    debug(`..price: ${lastExecutedPrice}, quantity: ${lastExecutedQuantity}, filled quantity: ${filledQuantity}`);

    if (orderStatus === 'NEW' || orderStatus === 'PARTIALLY_FILLED') {
      return false;
    }

    if (orderStatus !== 'FILLED') {
      throw new Error(`Order ${orderStatus}. Reason: ${data.r}`);
    }

    return true;
  };

  let stopSellAmount;
  let targetSellAmount;

  const waitForSellOrderFill = sellOrderId => new Promise((resolve, reject) => {
    let stopOrderId = sellOrderId;
    let targetOrderId = 0;

    try {
      binance.websockets.trades(pair, async (trades) => {
        try {
          const { s: symbol, p: price } = trades;
          debug(`${symbol} trade update. price: ${price} stop: ${stopPrice} target: ${targetPrice}`);
          if (stopOrderId && !targetOrderId && BigNumber(price).gte(targetPrice) && !isCancelling) {
            await cancelOrderAsync(symbol, stopOrderId);
            stopOrderId = 0;
            targetOrderId = await placeTargetOrderAsync(targetSellAmount);
          } else if (targetOrderId && !stopOrderId
            && BigNumber(price).lte(stopPrice) && !isCancelling) {
            await cancelOrderAsync(symbol, targetOrderId);
            targetOrderId = 0;
            stopOrderId = await placeStopOrderAsync(stopSellAmount);
          }
        } catch (err) {
          reject(err);
        }
      });

      binance.websockets.userData(() => { }, (data) => {
        try {
          const { i: orderId } = data;
          if (orderId === stopOrderId || orderId === targetOrderId) {
            if (isOrderFilled(data)) {
              resolve();
            }
          }
        } catch (err) {
          reject(err);
        }
      });

      binance.orderStatusAsync(pair, sellOrderId).then((response) => {
        if (response.status === 'FILLED') {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });

  let isLimitEntry = false;
  let isStopEntry = false;

  const waitForBuyOrderFill = buyOrderId => new Promise((resolve, reject) => {
    try {
      binance.websockets.trades(pair, async (trades) => {
        try {
          const { s: symbol, p: price } = trades;
          if (!cancelPrice) {
            debug(`${symbol} trade update. price: ${price} buy: ${buyPrice}`);
          } else {
            debug(`${symbol} trade update. price: ${price} buy: ${buyPrice} cancel: ${cancelPrice}`);

            if (((isStopEntry && price <= cancelPrice)
              || (isLimitEntry && price >= cancelPrice))
              && !isCancelling) {
              await cancelOrderAsync(symbol, buyOrderId);
              reject(new Error(`Order CANCELED. Reason: cancel price ${cancelPrice} hit`));
            }
          }
        } catch (err) {
          reject(err);
        }
      });

      binance.websockets.userData(() => { }, (data) => {
        try {
          const { i: orderId } = data;
          if (orderId === buyOrderId && isOrderFilled(data)) {
            resolve(data.N);
          }
        } catch (err) {
          reject(err);
        }
      });

      binance.orderStatusAsync(pair, buyOrderId).then((response) => {
        if (response.status === 'FILLED') {
          // Binance API doesn't provide commission asset information; default to BNB
          resolve('BNB');
        }
      });
    } catch (err) {
      reject(err);
    }
  });

  const adjustSellAmountsForCommission = async (commissionAsset, stepSize) => {
    if (commissionAsset !== 'BNB' || nonBnbFees) {
      try {
        const tradeFee = (await binance.tradeFeeAsync()).tradeFee.find(ei => ei.symbol === pair);
        stopSellAmount = binance.roundStep(stopSellAmount * (1 - tradeFee.maker), stepSize);
        targetSellAmount = binance.roundStep(targetSellAmount * (1 - tradeFee.maker), stepSize);
      } catch (err) {
        debug(`Could not pull trade fee for ${pair}: ${err.body}`);
        throw new Error(err.body);
      }
    }
  };

  const validateOrderMeetsTradingRules = (filters, quantity, price) => {
    const { minQty } = filters.find(eis => eis.filterType === 'LOT_SIZE');
    const { minPrice } = filters.find(eis => eis.filterType === 'PRICE_FILTER');
    const { minNotional } = filters.find(eis => eis.filterType === 'MIN_NOTIONAL');

    if (BigNumber(quantity).lt(minQty)) {
      throw new Error(`${quantity} does not meet minimum order amount ${minQty}.`);
    }

    if (BigNumber(price).lt(minPrice)) {
      throw new Error(`${price} does not meet minimum order price ${minPrice}.`);
    }

    if (BigNumber(price).times(quantity).lt(minNotional)) {
      throw new Error(`${quantity} @ ${price} does not meet minimum order value ${minNotional}.`);
    }
  };

  await binance.optionsAsync({
    APIKEY: process.env.APIKEY,
    APISECRET: process.env.APISECRET,
    useServerTime: true,
    reconnect: true,
  });

  const symbolData = (await binance.exchangeInfoAsync()).symbols.find(ei => ei.symbol === pair);
  if (!symbolData) {
    throw new Error(`Could not pull exchange info for ${pair}`);
  }

  const { filters } = symbolData;
  const { stepSize } = filters.find(eis => eis.filterType === 'LOT_SIZE');
  const { tickSize, minPrice } = filters.find(eis => eis.filterType === 'PRICE_FILTER');
  const { minNotional } = filters.find(eis => eis.filterType === 'MIN_NOTIONAL');

  amount = binance.roundStep(amount, stepSize);

  if (scaleOutAmount) {
    scaleOutAmount = binance.roundStep(scaleOutAmount, stepSize);
  }

  stopSellAmount = amount;
  targetSellAmount = scaleOutAmount || amount;

  if (buyPrice) {
    buyPrice = binance.roundTicks(buyPrice, tickSize);

    if (buyLimitPrice) {
      buyLimitPrice = binance.roundTicks(buyLimitPrice, tickSize);
    } else {
      const balances = await binance.balanceAsync();
      const { quoteAsset } = symbolData;
      const { available } = balances[quoteAsset];
      const maxAvailablePrice = binance.roundTicks(BigNumber(available).div(amount), tickSize);

      const prices = await binance.avgPriceAsync(pair);
      const currentPrice = Object.values(prices)[0];
      const { multiplierUp } = filters.find(eis => eis.filterType === 'PERCENT_PRICE');
      const maxPercentPrice = binance.roundTicks(currentPrice * multiplierUp, tickSize);

      buyLimitPrice = Math.min(maxAvailablePrice, maxPercentPrice);

      const { quotePrecision } = symbolData;
      buyLimitPrice = BigNumber(buyLimitPrice).minus(tickSize).toFixed(quotePrecision);
    }
  }

  if (stopPrice) {
    stopPrice = binance.roundTicks(stopPrice, tickSize);

    const minStopSellAmount = stopSellAmount - targetSellAmount
      ? Math.min(targetSellAmount, stopSellAmount - targetSellAmount)
      : stopSellAmount;

    if (buyPrice) {
      validateOrderMeetsTradingRules(filters, minStopSellAmount, stopPrice);
    }

    if (stopLimitPrice) {
      stopLimitPrice = binance.roundTicks(stopLimitPrice, tickSize);
      if (buyPrice) {
        validateOrderMeetsTradingRules(filters, minStopSellAmount, stopLimitPrice);
      }
    } else {
      const prices = await binance.avgPriceAsync(pair);
      const currentPrice = Object.values(prices)[0];
      const { multiplierDown } = filters.find(eis => eis.filterType === 'PERCENT_PRICE');
      const minPercentPrice = binance.roundTicks(currentPrice * multiplierDown, tickSize);
      const minNotionalPrice = binance.roundTicks(minNotional / minStopSellAmount, tickSize);

      stopLimitPrice = Math.max(minPrice, minPercentPrice, minNotionalPrice);

      const { quotePrecision } = symbolData;
      stopLimitPrice = BigNumber(stopLimitPrice).plus(tickSize).toFixed(quotePrecision);
    }
  }

  if (targetPrice) {
    targetPrice = binance.roundTicks(targetPrice, tickSize);
    if (buyPrice || stopPrice) {
      validateOrderMeetsTradingRules(filters, targetSellAmount, targetPrice);
    }
  }

  if (BigNumber(buyPrice).gte(0)) {
    let response;
    try {
      if (BigNumber(buyPrice).isZero()) {
        response = await binance.marketBuyAsync(pair, amount, { type: 'MARKET', newOrderRespType: 'FULL' });
      } else if (BigNumber(buyPrice).gt(0)) {
        const ticker = await binance.pricesAsync(pair);
        const currentPrice = ticker[pair];
        debug(`${pair} price: ${currentPrice}`);

        if (BigNumber(buyPrice).gt(currentPrice)) {
          isStopEntry = true;
          response = await binance.buyAsync(pair, amount, buyLimitPrice || buyPrice, { stopPrice: buyPrice, type: 'STOP_LOSS_LIMIT', newOrderRespType: 'FULL' });
        } else {
          isLimitEntry = true;
          response = await binance.buyAsync(pair, amount, buyPrice, { type: 'LIMIT', newOrderRespType: 'FULL' });
        }
      }
    } catch (err) {
      throw new Error(err.body);
    }

    debug('Buy response: %o', response);
    debug(`order id: ${response.orderId}`);

    let commissionAsset;
    if (response.status !== 'FILLED') {
      commissionAsset = await waitForBuyOrderFill(response.orderId).finally(disconnect);
    } else {
      // eslint-disable-next-line prefer-destructuring
      commissionAsset = response.fills[0].commissionAsset;
    }

    if (stopPrice || targetPrice) {
      await adjustSellAmountsForCommission(commissionAsset, stepSize);
    }
  }

  if (stopPrice && targetPrice) {
    if (targetSellAmount < stopSellAmount) {
      await placeStopOrderAsync(stopSellAmount - targetSellAmount);
      stopSellAmount = targetSellAmount;
    }

    const stopOrderId = await placeStopOrderAsync(stopSellAmount);
    await waitForSellOrderFill(stopOrderId).finally(disconnect);
  } else if (stopPrice && !targetPrice) {
    await placeStopOrderAsync(stopSellAmount);
  } else if (!stopPrice && targetPrice) {
    await placeTargetOrderAsync(targetSellAmount);
  }
};

module.exports = { binanceOco };
