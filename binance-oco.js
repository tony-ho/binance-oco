#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint func-names: ["warn", "as-needed"] */

require('dotenv').config();

const { argv } = require('yargs')
  .usage('Usage: $0')
  .example(
    '$0 -p BNBBTC -a 1 -b 0.002 -s 0.001 -t 0.003',
    'Place a buy order for 1 BNB @ 0.002 BTC. Once filled, place a stop-limit sell @ 0.001 BTC. If a price of 0.003 BTC is reached, cancel stop-limit order and place a limit sell @ 0.003 BTC.',
  )
  // '-p <tradingPair>'
  .demand('pair')
  .alias('p', 'pair')
  .describe('p', 'Set trading pair eg. BNBBTC')
  // '-a <amount>'
  .demand('amount')
  .number('a')
  .alias('a', 'amount')
  .describe('a', 'Set amount to buy/sell')
  // '-b <buyPrice>'
  .number('b')
  .alias('b', 'buy')
  .alias('b', 'e')
  .alias('b', 'entry')
  .describe('b', 'Set buy price (0 for market buy)')
  // '-s <stopPrice>'
  .number('s')
  .alias('s', 'stop')
  .describe('s', 'Set stop-limit order stop price')
  // '-l <limitPrice>'
  .number('l')
  .alias('l', 'limit')
  .describe('l', 'Set stop-limit order limit sell price (if different from stop price).')
  // '-t <targetPrice>'
  .number('t')
  .alias('t', 'target')
  .describe('t', 'Set target limit order sell price')
  // '-S <scaleOutAmount>'
  .number('S')
  .alias('S', 'scaleOutAmount')
  .describe('S', 'Set amount to sell (scale out) at target price (if different from amount)');

const {
  p: pair, a: amount, b: buyPrice, s: stopPrice, l: limitPrice, t: targetPrice, S: scaleOutAmount,
} = argv;

const Binance = require('node-binance-api');

const binance = new Binance().options({
  APIKEY: process.env.APIKEY,
  APISECRET: process.env.APISECRET,
  useServerTime: true,
  reconnect: false,
}, () => {
  const NON_BNB_TRADING_FEE = 0.001;

  const calculateSellAmount = function (commissionAsset, sellAmount) {
    // Adjust sell amount if BNB not used for trading fee
    return (commissionAsset === 'BNB') ? sellAmount : (sellAmount * (1 - NON_BNB_TRADING_FEE));
  };

  let stopSellAmount = amount;
  let targetSellAmount = scaleOutAmount || amount;

  const calculateStopAndTargetAmounts = function (commissionAsset) {
    stopSellAmount = calculateSellAmount(commissionAsset, stopSellAmount);
    targetSellAmount = calculateSellAmount(commissionAsset, targetSellAmount);
  };

  let stopOrderId = 0;
  let targetOrderId = 0;

  const sellComplete = function (error, response) {
    if (error) {
      console.log('Sell error', error.body);
      process.exit(1);
    }

    console.log('Sell response', response);
    console.log(`order id: ${response.orderId}`);

    if (!(stopPrice && targetPrice)) {
      process.exit();
    }

    if (response.type === 'STOP_LOSS_LIMIT') {
      stopOrderId = response.orderId;
    } else if (response.type === 'LIMIT') {
      targetOrderId = response.orderId;
    }
  };

  const placeStopOrder = function () {
    binance.sell(pair, stopSellAmount, limitPrice || stopPrice, { stopPrice, type: 'STOP_LOSS_LIMIT', newOrderRespType: 'FULL' }, sellComplete);
  };

  const placeTargetOrder = function () {
    binance.sell(pair, targetSellAmount, targetPrice, { type: 'LIMIT', newOrderRespType: 'FULL' }, sellComplete);
    if (stopPrice && targetSellAmount !== stopSellAmount) {
      stopSellAmount -= targetSellAmount;
      placeStopOrder();
    }
  };

  const placeSellOrder = function () {
    if (stopPrice) {
      placeStopOrder();
    } else if (targetPrice) {
      placeTargetOrder();
    } else {
      process.exit();
    }
  };

  let buyOrderId = 0;

  const buyComplete = function (error, response) {
    if (error) {
      console.log('Buy error', error.body);
      process.exit(1);
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

  if (buyPrice === 0) {
    binance.marketBuy(pair, amount, { type: 'MARKET', newOrderRespType: 'FULL' }, buyComplete);
  } else if (buyPrice > 0) {
    binance.prices(pair, (error, ticker) => {
      const currentPrice = ticker[pair];
      console.log(`${pair} price: ${currentPrice}`);

      if (buyPrice > currentPrice) {
        binance.buy(pair, amount, buyPrice, { stopPrice: buyPrice, type: 'STOP_LOSS_LIMIT', newOrderRespType: 'FULL' }, buyComplete);
      } else {
        binance.buy(pair, amount, buyPrice, { type: 'LIMIT', newOrderRespType: 'FULL' }, buyComplete);
      }
    });
  } else {
    placeSellOrder();
  }

  binance.websockets.trades([pair], (trades) => {
    const { s: symbol, p: price } = trades;

    if (buyOrderId) {
      console.log(`${symbol} trade update. price: ${price} buy: ${buyPrice}`);
    } else if (stopOrderId || targetOrderId) {
      console.log(`${symbol} trade update. price: ${price} stop: ${stopPrice} target: ${targetPrice}`);

      if (stopOrderId && !targetOrderId && price >= targetPrice) {
        binance.cancel(symbol, stopOrderId, (error, response) => {
          if (error) {
            console.log(`${symbol} cancel error:`, error.body);
            process.exit(1);
          }

          console.log(`${symbol} cancel response:`, response);
          stopOrderId = 0;
          placeTargetOrder();
        });
      } else if (targetOrderId && !stopOrderId && price <= stopPrice) {
        binance.cancel(symbol, targetOrderId, (error, response) => {
          if (error) {
            console.log(`${symbol} cancel error:`, error.body);
            process.exit(1);
          }

          console.log(`${symbol} cancel response:`, response);
          targetOrderId = 0;
          if (targetSellAmount !== stopSellAmount) {
            stopSellAmount += targetSellAmount;
          }
          placeStopOrder();
        });
      }
    }
  });

  const checkOrderFilled = function (data, orderFilled) {
    const {
      s: symbol, p: price, q: quantity, S: side, o: orderType, i: orderId, X: orderStatus,
    } = data;

    console.log(`${symbol} ${side} ${orderType} ORDER #${orderId} (${orderStatus})`);
    console.log(`..price: ${price}, quantity: ${quantity}`);

    if (orderStatus === 'NEW' || orderStatus === 'PARTIALLY_FILLED') {
      return;
    }

    if (orderStatus !== 'FILLED') {
      console.log(`Order ${orderStatus}. Reason: ${data.r}`);
      process.exit(1);
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
        process.exit();
      });
    } else if (orderId === targetOrderId) {
      checkOrderFilled(data, () => {
        process.exit();
      });
    }
  });
});

process.on('exit', () => {
  const endpoints = binance.websockets.subscriptions();
  binance.websockets.terminate(Object.entries(endpoints));
});
