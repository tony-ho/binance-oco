/* eslint-disable no-console */

const Binance = require('node-binance-api');

const binanceOco = options => new Promise((resolve, reject) => {
  const {
    pair,
    nonBnbFees,
  } = options;

  let {
    amount, buyPrice, buyLimitPrice, stopPrice, limitPrice, targetPrice, cancelPrice,
    scaleOutAmount,
  } = options;

  const binance = new Binance().options({
    APIKEY: process.env.APIKEY,
    APISECRET: process.env.APISECRET,
    useServerTime: true,
    reconnect: true,
  }, () => {
    binance.exchangeInfo((exchangeInfoError, exchangeInfoData) => {
      if (exchangeInfoError) {
        reject(new Error(`Could not pull exchange info: ${exchangeInfoError.body}`));
        return;
      }

      const symbolData = exchangeInfoData.symbols.find(ei => ei.symbol === pair);
      if (!symbolData) {
        reject(new Error(`Could not pull exchange info for ${pair}`));
        return;
      }

      const { filters } = symbolData;
      const { stepSize, minQty } = filters.find(eis => eis.filterType === 'LOT_SIZE');
      const { tickSize, minPrice } = filters.find(eis => eis.filterType === 'PRICE_FILTER');
      const { minNotional } = filters.find(eis => eis.filterType === 'MIN_NOTIONAL');

      amount = binance.roundStep(amount, stepSize);

      if (amount < minQty) {
        reject(new Error(`Amount ${amount} does not meet minimum order amount ${minQty}.`));
        return;
      }

      if (scaleOutAmount) {
        scaleOutAmount = binance.roundStep(scaleOutAmount, stepSize);

        if (scaleOutAmount < minQty) {
          reject(new Error(`Scale out amount ${scaleOutAmount} does not meet minimum order amount ${minQty}.`));
          return;
        }
      }

      if (buyPrice) {
        buyPrice = binance.roundTicks(buyPrice, tickSize);

        if (buyLimitPrice) {
          buyLimitPrice = binance.roundTicks(buyLimitPrice, tickSize);
        }

        if (buyPrice < minPrice) {
          reject(new Error(`Buy price ${buyPrice} does not meet minimum order price ${minPrice}.`));
          return;
        }

        if (buyPrice * amount < minNotional) {
          reject(new Error(`Buy order does not meet minimum order value ${minNotional}.`));
          return;
        }
      }

      let stopSellAmount = amount;

      if (stopPrice) {
        stopPrice = binance.roundTicks(stopPrice, tickSize);

        if (limitPrice) {
          limitPrice = binance.roundTicks(limitPrice, tickSize);

          if (limitPrice < minPrice) {
            reject(new Error(`Limit price ${limitPrice} does not meet minimum order price ${minPrice}.`));
            return;
          }

          if (limitPrice * stopSellAmount < minNotional) {
            reject(new Error(`Stop order does not meet minimum order value ${minNotional}.`));
            return;
          }
        } else {
          if (stopPrice < minPrice) {
            reject(new Error(`Stop price ${stopPrice} does not meet minimum order price ${minPrice}.`));
            return;
          }

          if (stopPrice * stopSellAmount < minNotional) {
            reject(new Error(`Stop order does not meet minimum order value ${minNotional}.`));
            return;
          }
        }
      }

      let targetSellAmount = scaleOutAmount || amount;

      if (targetPrice) {
        targetPrice = binance.roundTicks(targetPrice, tickSize);

        if (targetPrice < minPrice) {
          reject(new Error(`Target price ${targetPrice} does not meet minimum order price ${minPrice}.`));
          return;
        }

        if (targetPrice * targetSellAmount < minNotional) {
          reject(new Error(`Target order does not meet minimum order value ${minNotional}.`));
          return;
        }

        const remainingAmount = amount - targetSellAmount;
        if (remainingAmount && stopPrice) {
          if (remainingAmount < minQty) {
            reject(new Error(`Stop amount after scale out (${remainingAmount}) will not meet minimum order amount ${minQty}.`));
            return;
          }

          if (stopPrice * remainingAmount < minNotional) {
            reject(new Error(`Stop order after scale out will not meet minimum order value ${minNotional}.`));
            return;
          }
        }
      }

      if (cancelPrice) {
        cancelPrice = binance.roundTicks(cancelPrice, tickSize);
      }

      const NON_BNB_TRADING_FEE = 0.001;

      const calculateSellAmount = (commissionAsset, sellAmount) => ((commissionAsset === 'BNB' && !nonBnbFees) ? sellAmount : (sellAmount * (1 - NON_BNB_TRADING_FEE)));

      const calculateStopAndTargetAmounts = (commissionAsset) => {
        stopSellAmount = calculateSellAmount(commissionAsset, stopSellAmount);
        targetSellAmount = calculateSellAmount(commissionAsset, targetSellAmount);
      };

      let stopOrderId = 0;
      let targetOrderId = 0;

      const sellComplete = (error, response) => {
        if (error) {
          reject(new Error(`Sell error: ${error.body}`));
          return;
        }

        console.log('Sell response', response);
        console.log(`order id: ${response.orderId}`);

        if (!(stopPrice && targetPrice)) {
          resolve();
          return;
        }

        if (response.type === 'STOP_LOSS_LIMIT') {
          stopOrderId = response.orderId;
        } else if (response.type === 'LIMIT') {
          targetOrderId = response.orderId;
        }
      };

      const placeStopOrder = () => {
        binance.sell(pair, stopSellAmount, limitPrice || stopPrice, { stopPrice, type: 'STOP_LOSS_LIMIT', newOrderRespType: 'FULL' }, sellComplete);
      };

      const placeTargetOrder = () => {
        binance.sell(pair, targetSellAmount, targetPrice, { type: 'LIMIT', newOrderRespType: 'FULL' }, sellComplete);
        if (stopPrice && targetSellAmount !== stopSellAmount) {
          stopSellAmount -= targetSellAmount;
          placeStopOrder();
        }
      };

      const placeSellOrder = () => {
        if (stopPrice) {
          placeStopOrder();
        } else if (targetPrice) {
          placeTargetOrder();
        } else {
          resolve();
        }
      };

      let buyOrderId = 0;

      const buyComplete = (error, response) => {
        if (error) {
          reject(new Error(`Buy error: ${error.body}`));
          return;
        }

        console.log('Buy response', response);
        console.log(`order id: ${response.orderId}`);

        if (response.status === 'FILLED') {
          calculateStopAndTargetAmounts(response.fills[0].commissionAsset);
          placeSellOrder();
        } else {
          buyOrderId = response.orderId;
        }
      };

      let isLimitEntry = false;
      let isStopEntry = false;

      if (buyPrice === 0) {
        binance.marketBuy(pair, amount, { type: 'MARKET', newOrderRespType: 'FULL' }, buyComplete);
      } else if (buyPrice > 0) {
        binance.prices(pair, (error, ticker) => {
          const currentPrice = ticker[pair];
          console.log(`${pair} price: ${currentPrice}`);

          if (buyPrice > currentPrice) {
            isStopEntry = true;
            binance.buy(pair, amount, buyLimitPrice || buyPrice, { stopPrice: buyPrice, type: 'STOP_LOSS_LIMIT', newOrderRespType: 'FULL' }, buyComplete);
          } else {
            isLimitEntry = true;
            binance.buy(pair, amount, buyPrice, { type: 'LIMIT', newOrderRespType: 'FULL' }, buyComplete);
          }
        });
      } else {
        placeSellOrder();
      }

      let isCancelling = false;

      binance.websockets.trades([pair], (trades) => {
        const { s: symbol, p: price } = trades;

        if (buyOrderId) {
          if (!cancelPrice) {
            console.log(`${symbol} trade update. price: ${price} buy: ${buyPrice}`);
          } else {
            console.log(`${symbol} trade update. price: ${price} buy: ${buyPrice} cancel: ${cancelPrice}`);

            if (((isStopEntry && price <= cancelPrice)
              || (isLimitEntry && price >= cancelPrice))
              && !isCancelling) {
              isCancelling = true;
              binance.cancel(symbol, buyOrderId, (error, response) => {
                isCancelling = false;
                if (error) {
                  reject(new Error(`${symbol} cancel error: ${error.body}`));
                  return;
                }

                console.log(`${symbol} cancel response:`, response);
                resolve();
              });
            }
          }
        } else if (stopOrderId || targetOrderId) {
          console.log(`${symbol} trade update. price: ${price} stop: ${stopPrice} target: ${targetPrice}`);

          if (stopOrderId && !targetOrderId && price >= targetPrice && !isCancelling) {
            isCancelling = true;
            binance.cancel(symbol, stopOrderId, (error, response) => {
              isCancelling = false;
              if (error) {
                reject(new Error(`${symbol} cancel error: ${error.body}`));
                return;
              }

              stopOrderId = 0;
              console.log(`${symbol} cancel response:`, response);
              placeTargetOrder();
            });
          } else if (targetOrderId && !stopOrderId && price <= stopPrice && !isCancelling) {
            isCancelling = true;
            binance.cancel(symbol, targetOrderId, (error, response) => {
              isCancelling = false;
              if (error) {
                reject(new Error(`${symbol} cancel error: ${error.body}`));
                return;
              }

              targetOrderId = 0;
              console.log(`${symbol} cancel response:`, response);
              if (targetSellAmount !== stopSellAmount) {
                stopSellAmount += targetSellAmount;
              }
              placeStopOrder();
            });
          }
        }
      });

      const checkOrderFilled = (data, orderFilled) => {
        const {
          s: symbol, p: price, q: quantity, S: side, o: orderType, i: orderId, X: orderStatus,
        } = data;

        console.log(`${symbol} ${side} ${orderType} ORDER #${orderId} (${orderStatus})`);
        console.log(`..price: ${price}, quantity: ${quantity}`);

        if (orderStatus === 'NEW' || orderStatus === 'PARTIALLY_FILLED') {
          return;
        }

        if (orderStatus !== 'FILLED') {
          reject(new Error(`Order ${orderStatus}. Reason: ${data.r}`));
          return;
        }

        orderFilled(data);
      };

      binance.websockets.userData(() => { }, (data) => {
        const { i: orderId } = data;

        if (orderId === buyOrderId) {
          checkOrderFilled(data, () => {
            const { N: commissionAsset } = data;
            buyOrderId = 0;
            calculateStopAndTargetAmounts(commissionAsset);
            placeSellOrder();
          });
        } else if (orderId === stopOrderId) {
          checkOrderFilled(data, () => {
            resolve();
          });
        } else if (orderId === targetOrderId) {
          checkOrderFilled(data, () => {
            resolve();
          });
        }
      });
    });
  });
});

module.exports = { binanceOco };
