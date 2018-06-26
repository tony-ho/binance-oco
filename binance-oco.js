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
  .describe('t', 'Set target limit order sell price');

const {
  p: pair, a: amount, b: buyPrice, s: stopPrice, l: limitPrice, t: targetPrice,
} = argv;

const Binance = require('node-binance-api');

const binance = new Binance().options({
  APIKEY: process.env.APIKEY,
  APISECRET: process.env.APISECRET,
  useServerTime: true,
  reconnect: false,
}, () => {
  const NON_BNB_TRADING_FEE = 0.001;
  let sellAmount = amount;

  const calculateSellAmount = function (commissionAsset) {
    // Adjust sell amount if BNB not used for trading fee
    sellAmount = (commissionAsset === 'BNB') ? amount : (amount * (1 - NON_BNB_TRADING_FEE));
  };

  let sellOrderId = 0;

  const sellComplete = function (error, response) {
    if (error) {
      console.log('Sell error', error.body);
      process.exit(1);
    }

    console.log('Sell response', response);
    console.log(`order id: ${response.orderId}`);

    if (!stopPrice || !targetPrice) {
      process.exit();
    }

    sellOrderId = response.orderId;
  };

  const placeSellOrder = function () {
    if (stopPrice) {
      if (limitPrice) {
        binance.sell(pair, sellAmount, limitPrice, { stopPrice, type: 'STOP_LOSS_LIMIT' }, sellComplete);
      } else {
        binance.sell(pair, sellAmount, stopPrice, { stopPrice, type: 'STOP_LOSS_LIMIT' }, sellComplete);
      }
    } else if (targetPrice) {
      binance.sell(pair, sellAmount, targetPrice, { type: 'LIMIT' }, sellComplete);
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
      calculateSellAmount(response.fills[0].commissionAsset);
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
    } else if (sellOrderId) {
      console.log(`${symbol} trade update. price: ${price} stop: ${stopPrice} target: ${targetPrice}`);

      if (price >= targetPrice) {
        binance.cancel(symbol, sellOrderId, (error, response) => {
          if (error) {
            console.log(`${symbol} cancel error:`, error.body);
            process.exit(1);
          }

          console.log(`${symbol} cancel response:`, response);
          sellOrderId = 0;
          binance.sell(pair, sellAmount, targetPrice, { type: 'LIMIT' }, sellComplete);
        });
      }
    }
  });

  const orderUpdate = function (data, callback) {
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

    callback(data);
  };

  binance.websockets.userData(() => { }, (data) => {
    const { i: orderId } = data;

    if (orderId === buyOrderId) {
      orderUpdate(data, () => {
        const { N: commissionAsset } = data;
        buyOrderId = 0;
        calculateSellAmount(commissionAsset);
        placeSellOrder();
      });
    } else if (orderId === sellOrderId) {
      orderUpdate(data, () => {
        process.exit();
      });
    }
  });
});

process.on('exit', () => {
  const endpoints = binance.websockets.subscriptions();
  binance.websockets.terminate(Object.entries(endpoints));
});
