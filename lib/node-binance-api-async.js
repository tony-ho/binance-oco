const { promisify } = require('util');
const Binance = require('node-binance-api');

class BinanceAsync extends Binance {
  constructor() {
    super();
    this.avgPriceAsync = promisify(this.avgPrice);
    this.balanceAsync = promisify(this.balance);
    this.buyAsync = promisify(this.buy);
    this.cancelAsync = promisify(this.cancel);
    this.exchangeInfoAsync = promisify(this.exchangeInfo);
    this.marketBuyAsync = promisify(this.marketBuy);
    this.optionsAsync = promisify(this.options);
    this.orderStatusAsync = promisify(this.orderStatus);
    this.pricesAsync = promisify(this.prices);
    this.sellAsync = promisify(this.sell);
  }
}

module.exports = BinanceAsync;
