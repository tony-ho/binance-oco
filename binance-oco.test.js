/* eslint-disable no-undef */
jest.mock('./lib/node-binance-api-async');

const binance = require('./lib/node-binance-api-async');
const { binanceOco } = require('./binance-oco');

const mockBuy = jest.fn(() => ({
  orderId: '1',
  status: 'NEW',
}));
const mockCancel = jest.fn(() => ({
  orderId: '1',
}));
const mockExchangeInfo = jest.fn(() => ({
  symbols: [{
    symbol: 'BNBBTC',
    quoteAsset: 'BTC',
    filters: [
      { filterType: 'PRICE_FILTER', minPrice: 0.00000010, tickSize: 0.00000010 },
      { filterType: 'LOT_SIZE', minQty: 0.01000000, stepSize: 0.01000000 },
      { filterType: 'PERCENT_PRICE', multiplierDown: 0.01, multiplierUp: 10 },
      { filterType: 'MIN_NOTIONAL', minNotional: 0.00100000 },
    ],
  }],
}));
const mockMarketBuy = jest.fn(() => ({
  orderId: '1',
  status: 'FILLED',
  fills: [{ commissionAsset: 'BNB' }],
}));
const mockSell = jest.fn(() => ({
  orderId: '1',
  status: 'NEW',
}));

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
    binance.mockImplementation(() => ({
      avgPriceAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
      balanceAsync: jest.fn(() => ({ BTC: { available: '1' } })),
      exchangeInfoAsync: mockExchangeInfo,
      optionsAsync: jest.fn(),
      roundStep: jest.fn(amount => amount),
      roundTicks: jest.fn(price => price),
    }));
  });

  test('minimum scale out order amount not met', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.001,
      targetPrice: 0.002,
      scaleOutAmount: 0.001,
    })).rejects.toThrow('does not meet minimum order amount');
  });

  test('minimum remaining order amount not met', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.002,
      stopPrice: 0.001,
      targetPrice: 0.003,
      scaleOutAmount: 0.999,
    })).rejects.toThrow('does not meet minimum order amount');
  });

  test('minimum stop price not met', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.002,
      stopPrice: 0.00000001,
    })).rejects.toThrow('does not meet minimum order price');
  });

  test('minimum stop order value not met', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.002,
      stopPrice: 0.0001,
    })).rejects.toThrow('does not meet minimum order value');
  });

  test('minimum stop limit price not met', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.002,
      stopPrice: 0.001,
      stopLimitPrice: 0.00000001,
    })).rejects.toThrow('does not meet minimum order price');
  });

  test('minimum stop limit order value not met', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.002,
      stopPrice: 0.001,
      stopLimitPrice: 0.0001,
    })).rejects.toThrow('does not meet minimum order value');
  });

  test('minimum target order value not met', async () => {
    await expect(binanceOco({
      pair: 'BNBBTC',
      amount: 1,
      buyPrice: 0.002,
      targetPrice: 0.003,
      scaleOutAmount: 0.1,
    })).rejects.toThrow('does not meet minimum order value');
  });
});

describe('orders', () => {
  describe('buy orders', () => {
    beforeEach(() => {
      binance.mockImplementation(() => ({
        avgPriceAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        balanceAsync: jest.fn(() => ({ BTC: { available: '1' } })),
        buyAsync: mockBuy,
        cancelAsync: mockCancel,
        exchangeInfoAsync: mockExchangeInfo,
        marketBuyAsync: mockMarketBuy,
        optionsAsync: jest.fn(),
        pricesAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        roundStep: jest.fn(amount => amount),
        roundTicks: jest.fn(price => price),
        websockets: {
          subscriptions: jest.fn(() => ({})),
          terminate: jest.fn(),
          trades: jest.fn(),
          userData: jest.fn((_cb, cb) => {
            cb({
              i: '1',
              N: 'BNB',
              X: 'FILLED',
            });
          }),
        },
      }));
    });

    test('market buy order', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0,
      })).resolves.toBe();
      expect(mockMarketBuy).toBeCalledWith('BNBBTC', 1, { newOrderRespType: 'FULL', type: 'MARKET' });
    });

    test('limit buy order when buy price is below current price', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.001,
      })).resolves.toBe();
      expect(mockBuy).toBeCalledWith('BNBBTC', 1, 0.001, { newOrderRespType: 'FULL', type: 'LIMIT' });
    });

    test('stop limit buy order when buy price above current price', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.003,
      })).resolves.toBe();
      expect(mockBuy).toBeCalledWith('BNBBTC', 1, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.003, type: 'STOP_LOSS_LIMIT' });
    });

    test('buy order with buy limit price', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.003,
        buyLimitPrice: 0.004,
      })).resolves.toBe();
      expect(mockBuy).toBeCalledWith('BNBBTC', 1, 0.004, { newOrderRespType: 'FULL', stopPrice: 0.003, type: 'STOP_LOSS_LIMIT' });
    });

    test('buy order filled via order status', async () => {
      const mockOrderStatus = jest.fn(() => Promise.resolve({ status: 'FILLED' }));

      binance.mockImplementation(() => ({
        avgPriceAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        balanceAsync: jest.fn(() => ({ BTC: { available: '1' } })),
        buyAsync: mockBuy,
        exchangeInfoAsync: mockExchangeInfo,
        optionsAsync: jest.fn(),
        orderStatusAsync: mockOrderStatus,
        pricesAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        roundStep: jest.fn(amount => amount),
        roundTicks: jest.fn(price => price),
        websockets: {
          subscriptions: jest.fn(() => ({})),
          terminate: jest.fn(),
          trades: jest.fn(),
          userData: jest.fn(),
        },
      }));

      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
      })).resolves.toBe();
      expect(mockBuy).toBeCalled();
      expect(mockOrderStatus).toBeCalledWith('BNBBTC', '1');
    });

    test('buy order with cancel price', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        cancelPrice: 0.001,
      })).resolves.toBe();
      expect(mockBuy).toBeCalled();
      expect(mockCancel).not.toBeCalled();
    });

    test('buy order cancels when cancel price hit', async () => {
      binance.mockImplementation(() => ({
        avgPriceAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        balanceAsync: jest.fn(() => ({ BTC: { available: '1' } })),
        buyAsync: mockBuy,
        cancelAsync: mockCancel,
        exchangeInfoAsync: mockExchangeInfo,
        optionsAsync: jest.fn(),
        orderStatusAsync: jest.fn(() => Promise.resolve({ status: 'NEW' })),
        pricesAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        roundStep: jest.fn(amount => amount),
        roundTicks: jest.fn(price => price),
        websockets: {
          subscriptions: jest.fn(() => ({})),
          terminate: jest.fn(),
          trades: jest.fn((pair, cb) => {
            cb({ s: pair, p: '0.001' });
          }),
          userData: jest.fn(),
        },
      }));

      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        cancelPrice: 0.001,
      })).rejects.toThrow('Order CANCELED');
      expect(mockCancel).toBeCalledWith('BNBBTC', '1');
    });

    test('buy order canceled manually', async () => {
      binance.mockImplementation(() => ({
        avgPriceAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        balanceAsync: jest.fn(() => ({ BTC: { available: '1' } })),
        buyAsync: mockBuy,
        exchangeInfoAsync: mockExchangeInfo,
        optionsAsync: jest.fn(),
        pricesAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        roundStep: jest.fn(amount => amount),
        roundTicks: jest.fn(price => price),
        websockets: {
          subscriptions: jest.fn(() => ({})),
          terminate: jest.fn(),
          trades: jest.fn(),
          userData: jest.fn((_cb, cb) => {
            cb({
              i: '1',
              X: 'CANCELED',
            });
          }),
        },
      }));

      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.001,
      })).rejects.toThrow('Order CANCELED');
      expect(mockBuy).toBeCalled();
      expect(mockCancel).not.toBeCalled();
    });
  });

  describe('sell orders', () => {
    beforeEach(() => {
      binance.mockImplementation(() => ({
        avgPriceAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        exchangeInfoAsync: mockExchangeInfo,
        optionsAsync: jest.fn(),
        roundStep: jest.fn(amount => amount),
        roundTicks: jest.fn(price => price),
        sellAsync: mockSell,
        websockets: {
          subscriptions: jest.fn(() => ({})),
          terminate: jest.fn(),
          trades: jest.fn(),
          userData: jest.fn((_cb, cb) => {
            cb({
              i: '1',
              N: 'BNB',
              X: 'FILLED',
            });
          }),
        },
      }));
    });

    test('stop order', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        stopPrice: 0.001,
      })).resolves.toBe();
      expect(mockSell).toBeCalledWith('BNBBTC', 1, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.001, type: 'STOP_LOSS_LIMIT' });
    });

    test('stop order with stop limit price', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        stopPrice: 0.002,
        stopLimitPrice: 0.001,
      })).resolves.toBe();
      expect(mockSell).toBeCalledWith('BNBBTC', 1, 0.001, { newOrderRespType: 'FULL', stopPrice: 0.002, type: 'STOP_LOSS_LIMIT' });
    });

    test('target order', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        targetPrice: 0.003,
      })).resolves.toBe();
      expect(mockSell).toBeCalledWith('BNBBTC', 1, 0.003, { newOrderRespType: 'FULL', type: 'LIMIT' });
    });

    test('one-cancels-the-other order', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        stopPrice: 0.001,
        targetPrice: 0.003,
      })).resolves.toBe();
      expect(mockSell).toBeCalledWith('BNBBTC', 1, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.001, type: 'STOP_LOSS_LIMIT' });
      expect(mockSell).not.toBeCalledWith('BNBBTC', 1, 0.003, { newOrderRespType: 'FULL', type: 'LIMIT' });
    });

    test('one-cancels-the-other order with scale out', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 3,
        stopPrice: 0.001,
        targetPrice: 0.003,
        scaleOutAmount: 1,
      })).resolves.toBe();
      expect(mockSell).toBeCalledWith('BNBBTC', 1, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.001, type: 'STOP_LOSS_LIMIT' });
      expect(mockSell).toBeCalledWith('BNBBTC', 2, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.001, type: 'STOP_LOSS_LIMIT' });
      expect(mockSell).not.toBeCalledWith('BNBBTC', 1, 0.003, { newOrderRespType: 'FULL', type: 'LIMIT' });
    });

    test('sell order filled via order status', async () => {
      const mockOrderStatus = jest.fn(() => Promise.resolve({ status: 'FILLED' }));

      binance.mockImplementation(() => ({
        avgPriceAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        exchangeInfoAsync: mockExchangeInfo,
        optionsAsync: jest.fn(),
        orderStatusAsync: mockOrderStatus,
        roundStep: jest.fn(amount => amount),
        roundTicks: jest.fn(price => price),
        sellAsync: mockSell,
        websockets: {
          subscriptions: jest.fn(() => ({})),
          terminate: jest.fn(),
          trades: jest.fn(),
          userData: jest.fn(),
        },
      }));

      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        stopPrice: 0.001,
        targetPrice: 0.003,
      })).resolves.toBe();
      expect(mockSell).toBeCalled();
      expect(mockOrderStatus).toBeCalledWith('BNBBTC', '1');
    });

    test('one-cancels-the-other order canceled manually', async () => {
      binance.mockImplementation(() => ({
        avgPriceAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        cancelAsync: mockCancel,
        exchangeInfoAsync: mockExchangeInfo,
        optionsAsync: jest.fn(),
        roundStep: jest.fn(amount => amount),
        roundTicks: jest.fn(price => price),
        sellAsync: mockSell,
        websockets: {
          subscriptions: jest.fn(() => ({})),
          terminate: jest.fn(),
          trades: jest.fn(),
          userData: jest.fn((_cb, cb) => {
            cb({
              i: '1',
              N: 'BNB',
              X: 'CANCELED',
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
      expect(mockSell).toBeCalled();
      expect(mockCancel).not.toBeCalled();
    });
  });

  describe('buy and sell orders', () => {
    beforeEach(() => {
      binance.mockImplementation(() => ({
        avgPriceAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        balanceAsync: jest.fn(() => ({ BTC: { available: '1' } })),
        buyAsync: mockBuy,
        cancelAsync: mockCancel,
        exchangeInfoAsync: mockExchangeInfo,
        optionsAsync: jest.fn(),
        pricesAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        sellAsync: mockSell,
        roundStep: jest.fn(amount => amount),
        roundTicks: jest.fn(price => price),
        websockets: {
          subscriptions: jest.fn(() => ({})),
          terminate: jest.fn(),
          trades: jest.fn(),
          userData: jest.fn((_cb, cb) => {
            cb({
              i: '1',
              N: 'BNB',
              X: 'FILLED',
            });
          }),
        },
      }));
    });

    test('buy and stop order', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        stopPrice: 0.001,
      })).resolves.toBe();
      expect(mockBuy).toBeCalledWith('BNBBTC', 1, 0.002, { newOrderRespType: 'FULL', type: 'LIMIT' });
      expect(mockSell).toBeCalledWith('BNBBTC', 1, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.001, type: 'STOP_LOSS_LIMIT' });
    });

    test('buy and target order', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        targetPrice: 0.003,
      })).resolves.toBe();
      expect(mockBuy).toBeCalledWith('BNBBTC', 1, 0.002, { newOrderRespType: 'FULL', type: 'LIMIT' });
      expect(mockSell).toBeCalledWith('BNBBTC', 1, 0.003, { newOrderRespType: 'FULL', type: 'LIMIT' });
    });

    test('buy and target order with scale out', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        targetPrice: 0.003,
        scaleOutAmount: 0.5,
      })).resolves.toBe();
      expect(mockBuy).toBeCalledWith('BNBBTC', 1, 0.002, { newOrderRespType: 'FULL', type: 'LIMIT' });
      expect(mockSell).toBeCalledWith('BNBBTC', 0.5, 0.003, { newOrderRespType: 'FULL', type: 'LIMIT' });
    });

    test('sell amount adjusted when nonBnbFees option used', async () => {
      binance.mockImplementation(() => ({
        avgPriceAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        balanceAsync: jest.fn(() => ({ BTC: { available: '1' } })),
        buyAsync: mockBuy,
        exchangeInfoAsync: mockExchangeInfo,
        optionsAsync: jest.fn(),
        pricesAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
        sellAsync: mockSell,
        roundStep: jest.fn(amount => amount),
        roundTicks: jest.fn(price => price),
        tradeFeeAsync: jest.fn(() => ({
          tradeFee: [{
            symbol: 'BNBBTC',
            maker: 0.001,
            taker: 0.001,
          }],
        })),
        websockets: {
          subscriptions: jest.fn(() => ({})),
          terminate: jest.fn(),
          trades: jest.fn(),
          userData: jest.fn((_cb, cb) => {
            cb({
              i: '1',
              N: 'BNB',
              X: 'FILLED',
            });
          }),
        },
      }));

      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        stopPrice: 0.001,
        nonBnbFees: true,
      })).resolves.toBe();
      expect(mockBuy).toBeCalled();
      expect(mockSell).toBeCalledWith('BNBBTC', 0.999, expect.anything(), expect.anything());
    });

    test('sell amount adjusted when non BNB commission asset in buy response', async () => {
      binance.mockImplementation(() => ({
        avgPriceAsync: jest.fn(() => ({ XRPBTC: '0.002' })),
        exchangeInfoAsync: jest.fn(() => ({
          symbols: [{
            symbol: 'XRPBTC',
            quoteAsset: 'BTC',
            filters: [
              { filterType: 'PRICE_FILTER', minPrice: 0.00000010, tickSize: 0.00000010 },
              { filterType: 'LOT_SIZE', minQty: 0.01000000, stepSize: 0.01000000 },
              { filterType: 'PERCENT_PRICE', multiplierDown: 0.01, multiplierUp: 10 },
              { filterType: 'MIN_NOTIONAL', minNotional: 0.00100000 },
            ],
          }],
        })),
        marketBuyAsync: jest.fn(() => ({
          orderId: '1',
          status: 'FILLED',
          fills: [{ commissionAsset: 'XRP' }],
        })),
        optionsAsync: jest.fn(),
        sellAsync: mockSell,
        roundStep: jest.fn(amount => amount),
        roundTicks: jest.fn(price => price),
        tradeFeeAsync: jest.fn(() => ({
          tradeFee: [{
            symbol: 'XRPBTC',
            maker: 0.001,
            taker: 0.001,
          }],
        })),
      }));

      await expect(binanceOco({
        pair: 'XRPBTC',
        amount: 1,
        buyPrice: 0,
        stopPrice: 0.001,
      })).resolves.toBe();
      expect(mockSell).toBeCalledWith('XRPBTC', 0.999, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.001, type: 'STOP_LOSS_LIMIT' });
    });

    test('sell amount adjusted when non BNB commission asset in execution update', async () => {
      binance.mockImplementation(() => ({
        avgPriceAsync: jest.fn(() => ({ XRPBTC: '0.002' })),
        balanceAsync: jest.fn(() => ({ BTC: { available: '1' } })),
        buyAsync: mockBuy,
        exchangeInfoAsync: jest.fn(() => ({
          symbols: [{
            symbol: 'XRPBTC',
            quoteAsset: 'BTC',
            filters: [
              { filterType: 'PRICE_FILTER', minPrice: 0.00000010, tickSize: 0.00000010 },
              { filterType: 'LOT_SIZE', minQty: 0.01000000, stepSize: 0.01000000 },
              { filterType: 'PERCENT_PRICE', multiplierDown: 0.01, multiplierUp: 10 },
              { filterType: 'MIN_NOTIONAL', minNotional: 0.00100000 },
            ],
          }],
        })),
        optionsAsync: jest.fn(),
        pricesAsync: jest.fn(() => ({ XRPBTC: '0.002' })),
        sellAsync: mockSell,
        roundStep: jest.fn(amount => amount),
        roundTicks: jest.fn(price => price),
        tradeFeeAsync: jest.fn(() => ({
          tradeFee: [{
            symbol: 'XRPBTC',
            maker: 0.001,
            taker: 0.001,
          }],
        })),
        websockets: {
          subscriptions: jest.fn(() => ({})),
          terminate: jest.fn(),
          trades: jest.fn(),
          userData: jest.fn((_cb, cb) => {
            cb({
              i: '1',
              N: 'XRP',
              X: 'FILLED',
            });
          }),
        },
      }));

      await expect(binanceOco({
        pair: 'XRPBTC',
        amount: 1,
        buyPrice: 0.002,
        stopPrice: 0.001,
      })).resolves.toBe();
      expect(mockBuy).toBeCalled();
      expect(mockSell).toBeCalledWith('XRPBTC', 0.999, expect.anything(), expect.anything());
    });

    test('buy and one-cancels-the-other order: stop filled', async () => {
      await expect(binanceOco({
        pair: 'BNBBTC',
        amount: 1,
        buyPrice: 0.002,
        stopPrice: 0.001,
        targetPrice: 0.003,
      })).resolves.toBe();
      expect(mockBuy).toBeCalledWith('BNBBTC', 1, 0.002, { newOrderRespType: 'FULL', type: 'LIMIT' });
      expect(mockSell).toBeCalledWith('BNBBTC', 1, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.001, type: 'STOP_LOSS_LIMIT' });
      expect(mockSell).not.toBeCalledWith('BNBBTC', 1, 0.003, { newOrderRespType: 'FULL', type: 'LIMIT' });
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
      expect(mockBuy).toBeCalledWith('BNBBTC', 3, 0.002, { newOrderRespType: 'FULL', type: 'LIMIT' });
      expect(mockSell).toBeCalledWith('BNBBTC', 1, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.001, type: 'STOP_LOSS_LIMIT' });
      expect(mockSell).toBeCalledWith('BNBBTC', 2, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.001, type: 'STOP_LOSS_LIMIT' });
      expect(mockSell).not.toBeCalledWith('BNBBTC', 1, 0.003, { newOrderRespType: 'FULL', type: 'LIMIT' });
    });

    describe('one-cancels-the-other orders: target price is hit', () => {
      beforeEach(() => {
        binance.mockImplementation(() => ({
          avgPriceAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
          balanceAsync: jest.fn(() => ({ BTC: { available: '1' } })),
          buyAsync: mockBuy,
          cancelAsync: mockCancel,
          exchangeInfoAsync: mockExchangeInfo,
          optionsAsync: jest.fn(),
          pricesAsync: jest.fn(() => ({ BNBBTC: '0.002' })),
          sellAsync: mockSell,
          roundStep: jest.fn(amount => amount),
          roundTicks: jest.fn(price => price),
          websockets: {
            subscriptions: jest.fn(() => ({})),
            terminate: jest.fn(),
            trades: jest.fn((pair, cb) => {
              cb({ s: pair, p: '0.003' });
            }),
            userData: jest.fn((_cb, cb) => {
              cb({
                i: '1',
                N: 'BNB',
                X: 'FILLED',
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
        expect(mockBuy).toBeCalledWith('BNBBTC', 1, 0.002, { newOrderRespType: 'FULL', type: 'LIMIT' });
        expect(mockSell).toBeCalledWith('BNBBTC', 1, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.001, type: 'STOP_LOSS_LIMIT' });
        expect(mockCancel).toBeCalledWith('BNBBTC', '1');
        expect(mockSell).toBeCalledWith('BNBBTC', 1, 0.003, { newOrderRespType: 'FULL', type: 'LIMIT' });
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
        expect(mockBuy).toBeCalledWith('BNBBTC', 3, 0.002, { newOrderRespType: 'FULL', type: 'LIMIT' });
        expect(mockSell).toBeCalledWith('BNBBTC', 1, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.001, type: 'STOP_LOSS_LIMIT' });
        expect(mockSell).toBeCalledWith('BNBBTC', 2, expect.anything(), { newOrderRespType: 'FULL', stopPrice: 0.001, type: 'STOP_LOSS_LIMIT' });
        expect(mockCancel).toBeCalledWith('BNBBTC', '1');
        expect(mockSell).toBeCalledWith('BNBBTC', 1, 0.003, { newOrderRespType: 'FULL', type: 'LIMIT' });
      });
    });
  });
});
