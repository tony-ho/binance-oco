/* eslint-disable no-undef */
jest.mock('binance-api-node');

const binance = require('binance-api-node');
const { binanceOco } = require('./binance-oco');

const bnbbtcAvgPrice = jest.fn(() => ({ mins: '5', price: '0.002' }));
const bnbbtcPrices = jest.fn(() => ({ BNBBTC: '0.002' }));
const bnbbtcExchangeInfo = jest.fn(() => ({
  symbols: [{
    symbol: 'BNBBTC',
    status: 'TRADING',
    baseAsset: 'BNB',
    baseAssetPrecision: 8,
    quoteAsset: 'BTC',
    quotePrecision: 8,
    orderTypes: ['LIMIT', 'LIMIT_MAKER', 'MARKET', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT_LIMIT'],
    icebergAllowed: true,
    isSpotTradingAllowed: true,
    isMarginTradingAllowed: true,
    filters: [{
      filterType: 'PRICE_FILTER', minPrice: '0.00000000', maxPrice: '0.00000000', tickSize: '0.00000010',
    }, {
      filterType: 'PERCENT_PRICE', multiplierUp: '10', multiplierDown: '0.1', avgPriceMins: 5,
    }, {
      filterType: 'LOT_SIZE', minQty: '0.01000000', maxQty: '90000000.00000000', stepSize: '0.01000000',
    }, {
      filterType: 'MIN_NOTIONAL', minNotional: '0.00100000', applyToMarket: true, avgPriceMins: 5,
    }, { filterType: 'ICEBERG_PARTS', limit: 10 }, { filterType: 'MAX_NUM_ALGO_ORDERS', maxNumAlgoOrders: 5 }],
  }],
}));

const btcusdtAvgPrice = jest.fn(() => ({ mins: '5', price: '5000' }));
const btcusdtPrices = jest.fn(() => ({ BTCUSDT: '5000' }));
const btcusdtExchangeInfo = jest.fn(() => ({
  symbols: [{
    symbol: 'BTCUSDT',
    status: 'TRADING',
    baseAsset: 'BTC',
    baseAssetPrecision: 8,
    quoteAsset: 'USDT',
    quotePrecision: 8,
    orderTypes: ['LIMIT', 'LIMIT_MAKER', 'MARKET', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT_LIMIT'],
    icebergAllowed: true,
    isSpotTradingAllowed: true,
    isMarginTradingAllowed: true,
    filters: [{
      filterType: 'PRICE_FILTER', minPrice: '0.01000000', maxPrice: '10000000.00000000', tickSize: '0.01000000',
    }, {
      filterType: 'PERCENT_PRICE', multiplierUp: '10', multiplierDown: '0.1', avgPriceMins: 5,
    }, {
      filterType: 'LOT_SIZE', minQty: '0.00000100', maxQty: '10000000.00000000', stepSize: '0.00000100',
    }, {
      filterType: 'MIN_NOTIONAL', minNotional: '10.00000000', applyToMarket: true, avgPriceMins: 5,
    }, { filterType: 'ICEBERG_PARTS', limit: 10 }, { filterType: 'MAX_NUM_ALGO_ORDERS', maxNumAlgoOrders: 5 }],
  }],
}));

const mockAccountInfo = jest.fn(() => ({
  balances: [
    { asset: 'BTC', free: '1.00000000', locked: '0.00000000' },
    { asset: 'USDT', free: '5000.00000000', locked: '0.00000000' },
  ],
}));
const mockCancel = jest.fn(() => ({
  orderId: '1',
}));
const mockOrder = jest.fn(() => ({
  orderId: '1',
  status: 'NEW',
}));

beforeEach(() => {
  binance.default.mockImplementation(() => ({
    avgPrice: bnbbtcAvgPrice,
    accountInfo: mockAccountInfo,
    cancelOrder: mockCancel,
    exchangeInfo: bnbbtcExchangeInfo,
    order: mockOrder,
    prices: bnbbtcPrices,
    tradeFee: jest.fn(() => ({
      tradeFee: [{
        symbol: 'BNBBTC',
        maker: 0.001,
        taker: 0.001,
      }],
    })),
    ws: {
      trades: jest.fn(),
      user: jest.fn((cb) => {
        cb({
          eventType: 'executionReport',
          orderId: '1',
          commissionAsset: 'BNB',
          orderStatus: 'FILLED',
        });
      }),
    },
  }));
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('options validation', () => {
  test('fails without options', async () => {
    await expect(binanceOco()).rejects.toThrow();
  });

  test('fails without amount', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      buyPrice: 0.001,
    })).rejects.toThrow('ValidationError');
  });

  test('fails without pair', async () => {
    await expect(binanceOco({
      amount: 1,
      buyPrice: 0.001,
    })).rejects.toThrow('ValidationError');
  });

  test('fails without buy, stop, or target price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with buy limit price without buy price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      stopPrice: 0.001,
      buyLimitPrice: 0.001,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with cancel price without buy price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      stopPrice: 0.001,
      cancelPrice: 0.001,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with stop limit price without stop price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.001,
      stopLimitPrice: 0.001,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with scale out amount without target price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.001,
      scaleOutAmount: 0.5,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with zero amount', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 0,
      buyPrice: 0.001,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with zero buy limit price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.001,
      buyLimitPrice: 0,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with zero cancel price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.001,
      cancelPrice: 0,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with zero stop price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      stopPrice: 0,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with zero stop limit price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      stopPrice: 0.001,
      stopLimitPrice: 0,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with zero target price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      targetPrice: 0,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with zero scale out amount', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      targetPrice: 0.001,
      scaleOutAmount: 0,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with stop price above buy price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.001,
      stopPrice: 0.002,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with target price below buy price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.002,
      targetPrice: 0.001,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with target price below stop price', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0,
      stopPrice: 0.002,
      targetPrice: 0.001,
    })).rejects.toThrow('ValidationError');
  });

  test('fails with scale out amount above amount', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.001,
      targetPrice: 0.002,
      scaleOutAmount: 2,
    })).rejects.toThrow('ValidationError');
  });
});

describe('trading rules validation', () => {
  beforeEach(() => {
    binance.default.mockImplementation(() => ({
      accountInfo: mockAccountInfo,
      avgPrice: btcusdtAvgPrice,
      exchangeInfo: btcusdtExchangeInfo,
    }));
  });

  test('minimum stop price not met', async () => {
    await expect(binanceOco({
      pair: 'BTCUSDT',
      amount: 1,
      buyPrice: 5000,
      stopPrice: 0.001,
    })).rejects.toThrow('does not meet minimum order price');
  });

  test('minimum stop limit price not met', async () => {
    await expect(binanceOco({
      pair: 'BTCUSDT',
      amount: 1,
      buyPrice: 5000,
      stopPrice: 4000,
      stopLimitPrice: 0.001,
    })).rejects.toThrow('does not meet minimum order price');
  });

  test('minimum stop order value not met', async () => {
    await expect(binanceOco({
      pair: 'BTCUSDT',
      amount: 1,
      buyPrice: 5000,
      stopPrice: 1,
    })).rejects.toThrow('does not meet minimum order value');
  });

  test('minimum stop limit order value not met', async () => {
    await expect(binanceOco({
      pair: 'BTCUSDT',
      amount: 1,
      buyPrice: 5000,
      stopPrice: 4000,
      stopLimitPrice: 1,
    })).rejects.toThrow('does not meet minimum order value');
  });

  test('minimum target order value not met', async () => {
    await expect(binanceOco({
      pair: 'BTCUSDT',
      amount: 1,
      buyPrice: 5000,
      targetPrice: 6000,
      scaleOutAmount: 0.001,
    })).rejects.toThrow('does not meet minimum order value');
  });
});

describe('orders', () => {
  const getOrderFilled = jest.fn(() => Promise.resolve({ status: 'FILLED' }));

  describe('buy orders', () => {
    test('market buy order', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'BUY', quantity: 1, newOrderRespType: 'FULL', type: 'MARKET',
      });
    });

    test('limit buy order when buy price is below current price', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.001,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'BUY', quantity: 1, price: '0.0010000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
    });

    test('stop limit buy order when buy price above current price', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.003,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'BUY', quantity: 1, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0030000', type: 'STOP_LOSS_LIMIT',
      });
    });

    test('buy order with buy limit price', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.003,
        buyLimitPrice: 0.004,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'BUY', quantity: 1, price: '0.0040000', newOrderRespType: 'FULL', stopPrice: '0.0030000', type: 'STOP_LOSS_LIMIT',
      });
    });

    test('buy order filled via order status', async () => {
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        accountInfo: mockAccountInfo,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        getOrder: getOrderFilled,
        prices: bnbbtcPrices,
        ws: {
          trades: jest.fn(),
          user: jest.fn(),
        },
      }));

      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
      })).resolves.toBe();
      expect(mockOrder).toBeCalled();
      expect(getOrderFilled).toBeCalledWith({ symbol: 'BNBBTC', orderId: '1' });
    });

    test('buy order with cancel price', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        cancelPrice: 0.001,
      })).resolves.toBe();
      expect(mockOrder).toBeCalled();
      expect(mockCancel).not.toBeCalled();
    });

    test('buy order cancels when cancel price hit', async () => {
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        accountInfo: mockAccountInfo,
        cancelOrder: mockCancel,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        getOrder: jest.fn(() => Promise.resolve({ status: 'NEW' })),
        prices: bnbbtcPrices,
        ws: {
          trades: jest.fn((symbol, cb) => {
            cb({ symbol, price: '0.001' });
          }),
          user: jest.fn(),
        },
      }));

      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        cancelPrice: 0.001,
      })).rejects.toThrow('Order CANCELED');
      expect(mockCancel).toBeCalledWith({ symbol: 'BNBBTC', orderId: '1' });
    });

    test('buy order canceled manually', async () => {
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        accountInfo: mockAccountInfo,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        prices: bnbbtcPrices,
        ws: {
          trades: jest.fn(),
          user: jest.fn((cb) => {
            cb({
              eventType: 'executionReport',
              orderId: '1',
              orderStatus: 'CANCELED',
            });
          }),
        },
      }));

      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.001,
      })).rejects.toThrow('Order CANCELED');
      expect(mockOrder).toBeCalled();
      expect(mockCancel).not.toBeCalled();
    });
  });

  describe('sell orders', () => {
    test('stop order', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        stopPrice: 0.001,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0010000', type: 'STOP_LOSS_LIMIT',
      });
    });

    test('stop order with stop limit price', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        stopPrice: 0.002,
        stopLimitPrice: 0.001,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: '0.0010000', newOrderRespType: 'FULL', stopPrice: '0.0020000', type: 'STOP_LOSS_LIMIT',
      });
    });

    test('target order', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        targetPrice: 0.003,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: '0.0030000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
    });

    test('one-cancels-the-other order', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        stopPrice: 0.001,
        targetPrice: 0.003,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0010000', type: 'STOP_LOSS_LIMIT',
      });
      expect(mockOrder).not.toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: '0.0030000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
    });

    test('one-cancels-the-other order with scale out', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 3,
        stopPrice: 0.001,
        targetPrice: 0.003,
        scaleOutAmount: 1,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0010000', type: 'STOP_LOSS_LIMIT',
      });
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 2, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0010000', type: 'STOP_LOSS_LIMIT',
      });
      expect(mockOrder).not.toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: '0.0030000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
    });

    test('sell order filled via order status', async () => {
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        exchangeInfo: bnbbtcExchangeInfo,
        getOrder: getOrderFilled,
        order: mockOrder,
        ws: {
          trades: jest.fn(),
          user: jest.fn(),
        },
      }));

      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        stopPrice: 0.001,
        targetPrice: 0.003,
      })).resolves.toBe();
      expect(mockOrder).toBeCalled();
      expect(getOrderFilled).toBeCalledWith({ symbol: 'BNBBTC', orderId: '1' });
    });

    test('one-cancels-the-other order canceled manually', async () => {
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        cancelOrder: mockCancel,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        ws: {
          trades: jest.fn(),
          user: jest.fn((cb) => {
            cb({
              eventType: 'executionReport',
              orderId: '1',
              commissionAsset: 'BNB',
              orderStatus: 'CANCELED',
            });
          }),
        },
      }));

      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        stopPrice: 0.001,
        targetPrice: 0.003,
      })).rejects.toThrow('Order CANCELED');
      expect(mockOrder).toBeCalled();
      expect(mockCancel).not.toBeCalled();
    });
  });

  describe('buy and sell orders', () => {
    test('buy and stop order', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        stopPrice: 0.001,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'BUY', quantity: 1, price: '0.0020000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0010000', type: 'STOP_LOSS_LIMIT',
      });
    });

    test('buy and target order', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        targetPrice: 0.003,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'BUY', quantity: 1, price: '0.0020000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: '0.0030000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
    });

    test('buy and target order with scale out', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        targetPrice: 0.003,
        scaleOutAmount: 0.5,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'BUY', quantity: 1, price: '0.0020000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 0.5, price: '0.0030000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
    });

    test('sell amount adjusted when nonBnbFees option used', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 10,
        buyPrice: 0.002,
        stopPrice: 0.001,
        nonBnbFees: true,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 9.99, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0010000', type: 'STOP_LOSS_LIMIT',
      });
    });

    test('sell amount adjusted when non BNB commission asset in buy response', async () => {
      const orderWithNonBnbCommission = jest.fn(() => ({
        orderId: '1',
        status: 'FILLED',
        fills: [{ commissionAsset: 'BTC' }],
      }));
      binance.default.mockImplementation(() => ({
        avgPrice: btcusdtAvgPrice,
        exchangeInfo: btcusdtExchangeInfo,
        order: orderWithNonBnbCommission,
        prices: btcusdtPrices,
        tradeFee: jest.fn(() => ({
          tradeFee: [{
            symbol: 'BTCUSDT',
            maker: 0.001,
            taker: 0.001,
          }],
        })),
      }));

      await expect(binanceOco({
        pair: 'BTCUSDT',
        amount: 1,
        buyPrice: 0,
        stopPrice: 4000,
      })).resolves.toBe();
      expect(orderWithNonBnbCommission).toBeCalledWith({
        symbol: 'BTCUSDT', side: 'SELL', quantity: 0.999, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '4000.00', type: 'STOP_LOSS_LIMIT',
      });
    });

    test('sell amount adjusted when non BNB commission asset in execution update', async () => {
      binance.default.mockImplementation(() => ({
        accountInfo: mockAccountInfo,
        avgPrice: btcusdtAvgPrice,
        exchangeInfo: btcusdtExchangeInfo,
        order: mockOrder,
        prices: btcusdtPrices,
        tradeFee: jest.fn(() => ({
          tradeFee: [{
            symbol: 'BTCUSDT',
            maker: 0.001,
            taker: 0.001,
          }],
        })),
        ws: {
          trades: jest.fn(),
          user: jest.fn((cb) => {
            cb({
              eventType: 'executionReport',
              orderId: '1',
              commissionAsset: 'BTC',
              orderStatus: 'FILLED',
            });
          }),
        },
      }));

      await expect(binanceOco({
        pair: 'BTCUSDT',
        amount: 1,
        buyPrice: 5000,
        stopPrice: 4000,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BTCUSDT', side: 'SELL', quantity: 0.999, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '4000.00', type: 'STOP_LOSS_LIMIT',
      });
    });

    test('buy and one-cancels-the-other order: stop filled', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        stopPrice: 0.001,
        targetPrice: 0.003,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'BUY', quantity: 1, price: '0.0020000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0010000', type: 'STOP_LOSS_LIMIT',
      });
      expect(mockOrder).not.toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: '0.0030000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
    });

    test('buy and one-cancels-the-other order with scale out: stop filled', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 3,
        buyPrice: 0.002,
        stopPrice: 0.001,
        targetPrice: 0.003,
        scaleOutAmount: 1,
      })).resolves.toBe();
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'BUY', quantity: 3, price: '0.0020000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0010000', type: 'STOP_LOSS_LIMIT',
      });
      expect(mockOrder).toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 2, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0010000', type: 'STOP_LOSS_LIMIT',
      });
      expect(mockOrder).not.toBeCalledWith({
        symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: '0.0030000', newOrderRespType: 'FULL', type: 'LIMIT',
      });
    });

    describe('one-cancels-the-other orders: target price is hit', () => {
      beforeEach(() => {
        binance.default.mockImplementation(() => ({
          avgPrice: bnbbtcAvgPrice,
          accountInfo: mockAccountInfo,
          cancelOrder: mockCancel,
          exchangeInfo: bnbbtcExchangeInfo,
          order: mockOrder,
          prices: bnbbtcPrices,
          ws: {
            trades: jest.fn((symbol, cb) => {
              cb({ symbol, price: '0.003' });
            }),
            user: jest.fn((cb) => {
              cb({
                eventType: 'executionReport',
                orderId: '1',
                commissionAsset: 'BNB',
                orderStatus: 'FILLED',
              });
            }),
          },
        }));
      });

      test('buy and one-cancels-the-other order: target price hit', async () => {
        await expect(binanceOco({
          pair: 'BNBBTC',
          amount: 1,
          buyPrice: 0.002,
          stopPrice: 0.001,
          targetPrice: 0.003,
        })).resolves.toBe();
        expect(mockOrder).toBeCalledWith({
          symbol: 'BNBBTC', side: 'BUY', quantity: 1, price: '0.0020000', newOrderRespType: 'FULL', type: 'LIMIT',
        });
        expect(mockOrder).toBeCalledWith({
          symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0010000', type: 'STOP_LOSS_LIMIT',
        });
        expect(mockCancel).toBeCalledWith({ symbol: 'BNBBTC', orderId: '1' });
        expect(mockOrder).toBeCalledWith({
          symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: '0.0030000', newOrderRespType: 'FULL', type: 'LIMIT',
        });
      });

      test('buy and one-cancels-the-other order with scale out: target price hit', async () => {
        await expect(binanceOco({
          pair: 'BNBBTC',
          amount: 3,
          buyPrice: 0.002,
          stopPrice: 0.001,
          targetPrice: 0.003,
          scaleOutAmount: 1,
        })).resolves.toBe();
        expect(mockOrder).toBeCalledWith({
          symbol: 'BNBBTC', side: 'BUY', quantity: 3, price: '0.0020000', newOrderRespType: 'FULL', type: 'LIMIT',
        });
        expect(mockOrder).toBeCalledWith({
          symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0010000', type: 'STOP_LOSS_LIMIT',
        });
        expect(mockOrder).toBeCalledWith({
          symbol: 'BNBBTC', side: 'SELL', quantity: 2, price: expect.anything(), newOrderRespType: 'FULL', stopPrice: '0.0010000', type: 'STOP_LOSS_LIMIT',
        });
        expect(mockCancel).toBeCalledWith({ symbol: 'BNBBTC', orderId: '1' });
        expect(mockOrder).toBeCalledWith({
          symbol: 'BNBBTC', side: 'SELL', quantity: 1, price: '0.0030000', newOrderRespType: 'FULL', type: 'LIMIT',
        });
      });
    });
  });
});
