/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ErrorCodes } from "binance-api-node";

/* eslint-disable @typescript-eslint/no-var-requires */
jest.mock("binance-api-node");

const binance = require("binance-api-node");
const { binanceOco } = require("../src/binance-oco");

const bnbbtcAvgPrice = jest.fn(() => ({ mins: "5", price: "0.002" }));
const bnbbtcPrices = jest.fn(() => ({ BNBBTC: "0.002" }));
const bnbbtcExchangeInfo = jest.fn(() => ({
  symbols: [
    {
      symbol: "BNBBTC",
      status: "TRADING",
      baseAsset: "BNB",
      baseAssetPrecision: 8,
      quoteAsset: "BTC",
      quotePrecision: 8,
      orderTypes: [
        "LIMIT",
        "LIMIT_MAKER",
        "MARKET",
        "STOP_LOSS_LIMIT",
        "TAKE_PROFIT_LIMIT"
      ],
      icebergAllowed: true,
      isSpotTradingAllowed: true,
      isMarginTradingAllowed: true,
      filters: [
        {
          filterType: "PRICE_FILTER",
          minPrice: "0.00000000",
          maxPrice: "0.00000000",
          tickSize: "0.00000010"
        },
        {
          filterType: "PERCENT_PRICE",
          multiplierUp: "10",
          multiplierDown: "0.1",
          avgPriceMins: 5
        },
        {
          filterType: "LOT_SIZE",
          minQty: "0.01000000",
          maxQty: "90000000.00000000",
          stepSize: "0.01000000"
        },
        {
          filterType: "MIN_NOTIONAL",
          minNotional: "0.00100000",
          applyToMarket: true,
          avgPriceMins: 5
        },
        { filterType: "ICEBERG_PARTS", limit: 10 },
        { filterType: "MAX_NUM_ALGO_ORDERS", maxNumAlgoOrders: 5 }
      ]
    }
  ]
}));

const btcusdtAvgPrice = jest.fn(() => ({ mins: "5", price: "5000" }));
const btcusdtPrices = jest.fn(() => ({ BTCUSDT: "5000" }));
const btcusdtExchangeInfo = jest.fn(() => ({
  symbols: [
    {
      symbol: "BTCUSDT",
      status: "TRADING",
      baseAsset: "BTC",
      baseAssetPrecision: 8,
      quoteAsset: "USDT",
      quotePrecision: 8,
      orderTypes: [
        "LIMIT",
        "LIMIT_MAKER",
        "MARKET",
        "STOP_LOSS_LIMIT",
        "TAKE_PROFIT_LIMIT"
      ],
      icebergAllowed: true,
      isSpotTradingAllowed: true,
      isMarginTradingAllowed: true,
      filters: [
        {
          filterType: "PRICE_FILTER",
          minPrice: "0.01000000",
          maxPrice: "10000000.00000000",
          tickSize: "0.01000000"
        },
        {
          filterType: "PERCENT_PRICE",
          multiplierUp: "10",
          multiplierDown: "0.1",
          avgPriceMins: 5
        },
        {
          filterType: "LOT_SIZE",
          minQty: "0.00000100",
          maxQty: "10000000.00000000",
          stepSize: "0.00000100"
        },
        {
          filterType: "MIN_NOTIONAL",
          minNotional: "10.00000000",
          applyToMarket: true,
          avgPriceMins: 5
        },
        { filterType: "ICEBERG_PARTS", limit: 10 },
        { filterType: "MAX_NUM_ALGO_ORDERS", maxNumAlgoOrders: 5 }
      ]
    }
  ]
}));

const mockAccountInfo = jest.fn(() => ({
  balances: [
    { asset: "BTC", free: "1.00000000", locked: "0.00000000" },
    { asset: "USDT", free: "5000.00000000", locked: "0.00000000" }
  ]
}));
const mockCancel = jest.fn(() => ({
  orderId: "1"
}));
const mockOrder = jest.fn(() => ({
  orderId: "1",
  status: "NEW"
}));
const mockOrderTest = jest.fn();
const mockOrderOco = jest.fn(() => ({
  orderListId: "1",
  status: "NEW"
}));

beforeEach(() => {
  binance.default.mockImplementation(() => ({
    avgPrice: bnbbtcAvgPrice,
    accountInfo: mockAccountInfo,
    cancelOrder: mockCancel,
    exchangeInfo: bnbbtcExchangeInfo,
    order: mockOrder,
    orderTest: mockOrderTest,
    orderOco: mockOrderOco,
    prices: bnbbtcPrices,
    tradeFee: jest.fn(() => ({
      tradeFee: [
        {
          symbol: "BNBBTC",
          maker: 0.001,
          taker: 0.001
        }
      ]
    })),
    ws: {
      trades: jest.fn(),
      user: jest.fn(cb => {
        cb({
          eventType: "executionReport",
          orderId: "1",
          commissionAsset: "BNB",
          orderStatus: "FILLED"
        });
      })
    }
  }));
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("options validation", () => {
  test("fails without options", async () => {
    await expect(binanceOco()).rejects.toThrow();
  });

  test("fails without amount", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        buyPrice: 0.001
      })
    ).rejects.toThrow("amount");
  });

  test("fails without pair", async () => {
    await expect(
      binanceOco({
        amount: 1,
        buyPrice: 0.001
      })
    ).rejects.toThrow("pair");
  });

  test("fails without buy, stop, or target price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1
      })
    ).rejects.toThrow("buyPrice");
  });

  test("fails with buy limit price without buy price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        stopPrice: 0.001,
        buyLimitPrice: 0.001
      })
    ).rejects.toThrow("buyLimitPrice");
  });

  test("fails with cancel price without buy price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        stopPrice: 0.001,
        cancelPrice: 0.001
      })
    ).rejects.toThrow("cancelPrice");
  });

  test("fails with stop limit price without stop price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        buyPrice: 0.001,
        stopLimitPrice: 0.001
      })
    ).rejects.toThrow("stopLimitPrice");
  });

  test("fails with scale out amount without target price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        buyPrice: 0.001,
        scaleOutAmount: 0.5
      })
    ).rejects.toThrow("scaleOutAmount");
  });

  test("fails with zero amount", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 0,
        buyPrice: 0.001
      })
    ).rejects.toThrow("amount");
  });

  test("fails with zero buy limit price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        buyPrice: 0.001,
        buyLimitPrice: 0
      })
    ).rejects.toThrow("buyLimitPrice");
  });

  test("fails with zero cancel price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        buyPrice: 0.001,
        cancelPrice: 0
      })
    ).rejects.toThrow("cancelPrice");
  });

  test("fails with zero stop price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        stopPrice: 0
      })
    ).rejects.toThrow("stopPrice");
  });

  test("fails with zero stop limit price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        stopPrice: 0.001,
        stopLimitPrice: 0
      })
    ).rejects.toThrow("stopLimitPrice");
  });

  test("fails with zero target price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        targetPrice: 0
      })
    ).rejects.toThrow("targetPrice");
  });

  test("fails with zero scale out amount", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        targetPrice: 0.001,
        scaleOutAmount: 0
      })
    ).rejects.toThrow("scaleOutAmount");
  });

  test("fails with stop price above buy price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        buyPrice: 0.001,
        stopPrice: 0.002
      })
    ).rejects.toThrow("stopPrice");
  });

  test("fails with target price below buy price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        buyPrice: 0.002,
        targetPrice: 0.001
      })
    ).rejects.toThrow("targetPrice");
  });

  test("fails with target price below stop price", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        buyPrice: 0,
        stopPrice: 0.002,
        targetPrice: 0.001
      })
    ).rejects.toThrow("targetPrice");
  });

  test("fails with scale out amount above amount", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        buyPrice: 0.001,
        targetPrice: 0.002,
        scaleOutAmount: 2
      })
    ).rejects.toThrow("scaleOutAmount");
  });
});

describe("order validation", () => {
  test("buy order only is not checked", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        buyPrice: 0
      })
    ).resolves.not.toBeDefined();
    expect(mockOrderTest).not.toBeCalled();
  });

  test("stop order only is not checked", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        stopPrice: 0.001
      })
    ).resolves.not.toBeDefined();
    expect(mockOrderTest).not.toBeCalled();
  });

  test("target order only is not checked", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        targetPrice: 0.003
      })
    ).resolves.not.toBeDefined();
    expect(mockOrderTest).not.toBeCalled();
  });

  test("one-cancels-the-other order checks target order", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        stopPrice: 0.001,
        targetPrice: 0.003
      })
    ).resolves.not.toBeDefined();
    expect(mockOrderTest).toBeCalledWith({
      symbol: "BNBBTC",
      side: "SELL",
      quantity: "1.00",
      price: "0.0030000",
      type: "LIMIT"
    });
  });

  test("one-cancels-the-other order with scale out checks stop and target orders", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 3,
        stopPrice: 0.001,
        targetPrice: 0.003,
        scaleOutAmount: 1
      })
    ).resolves.not.toBeDefined();
    expect(mockOrderTest).toBeCalledWith({
      symbol: "BNBBTC",
      side: "SELL",
      quantity: "1.00",
      price: expect.anything(),
      stopPrice: "0.0010000",
      type: "STOP_LOSS_LIMIT"
    });
    expect(mockOrderTest).toBeCalledWith({
      symbol: "BNBBTC",
      side: "SELL",
      quantity: "1.00",
      price: "0.0030000",
      type: "LIMIT"
    });
  });

  test("buy and stop order checks stop order", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        buyPrice: 0.002,
        stopPrice: 0.001
      })
    ).resolves.not.toBeDefined();
    expect(mockOrderTest).toBeCalledWith({
      symbol: "BNBBTC",
      side: "SELL",
      quantity: "1.00",
      price: expect.anything(),
      stopPrice: "0.0010000",
      type: "STOP_LOSS_LIMIT"
    });
  });

  test("buy and target order checks target order", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        buyPrice: 0.002,
        targetPrice: 0.003
      })
    ).resolves.not.toBeDefined();
    expect(mockOrderTest).toBeCalledWith({
      symbol: "BNBBTC",
      side: "SELL",
      quantity: "1.00",
      price: "0.0030000",
      type: "LIMIT"
    });
  });

  test("buy and one-cancels-the-other order checks stop and target orders", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 1,
        buyPrice: 0.002,
        stopPrice: 0.001,
        targetPrice: 0.003
      })
    ).resolves.not.toBeDefined();
    expect(mockOrderTest).toBeCalledWith({
      symbol: "BNBBTC",
      side: "SELL",
      quantity: "1.00",
      price: expect.anything(),
      stopPrice: "0.0010000",
      type: "STOP_LOSS_LIMIT"
    });
    expect(mockOrderTest).toBeCalledWith({
      symbol: "BNBBTC",
      side: "SELL",
      quantity: "1.00",
      price: "0.0030000",
      type: "LIMIT"
    });
  });

  test("buy and one-cancels-the-other order with scale out checks stop and target orders", async () => {
    await expect(
      binanceOco({
        pair: "BNBBTC",
        amount: 3,
        buyPrice: 0.002,
        stopPrice: 0.001,
        targetPrice: 0.003,
        scaleOutAmount: 1
      })
    ).resolves.not.toBeDefined();
    expect(mockOrderTest).toBeCalledWith({
      symbol: "BNBBTC",
      side: "SELL",
      quantity: "1.00",
      price: expect.anything(),
      stopPrice: "0.0010000",
      type: "STOP_LOSS_LIMIT"
    });
    expect(mockOrderTest).toBeCalledWith({
      symbol: "BNBBTC",
      side: "SELL",
      quantity: "1.00",
      price: "0.0030000",
      type: "LIMIT"
    });
  });
});

describe("orders", () => {
  const getOrderFilled = jest.fn(() => Promise.resolve({ status: "FILLED" }));

  describe("buy orders", () => {
    test("market buy order", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "BUY",
        quantity: "1.00",
        type: "MARKET"
      });
    });

    test("limit buy order when buy price is below current price", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.001
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "BUY",
        quantity: "1.00",
        price: "0.0010000",
        type: "LIMIT"
      });
    });

    test("stop limit buy order when buy price above current price", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.003
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "BUY",
        quantity: "1.00",
        price: expect.anything(),
        newOrderRespType: "FULL",
        stopPrice: "0.0030000",
        type: "STOP_LOSS_LIMIT"
      });
    });

    test("buy order with buy limit price", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.003,
          buyLimitPrice: 0.004
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "BUY",
        quantity: "1.00",
        price: "0.0040000",
        newOrderRespType: "FULL",
        stopPrice: "0.0030000",
        type: "STOP_LOSS_LIMIT"
      });
    });

    test("buy order filled via order status", async () => {
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        accountInfo: mockAccountInfo,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        orderTest: jest.fn(),
        getOrder: getOrderFilled,
        prices: bnbbtcPrices,
        ws: {
          trades: jest.fn(),
          user: jest.fn()
        }
      }));

      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.002
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalled();
      expect(getOrderFilled).toBeCalledWith({ symbol: "BNBBTC", orderId: "1" });
    });

    const getOrderDoesNotExist = jest.fn(() => {
      const error = new Error("Order does not exist");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).code = ErrorCodes.NO_SUCH_ORDER;
      throw error;
    });

    test("order does not exist error is ignored", async () => {
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        accountInfo: mockAccountInfo,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        orderTest: jest.fn(),
        getOrder: getOrderDoesNotExist,
        prices: bnbbtcPrices,
        ws: {
          trades: jest.fn(),
          user: jest.fn(cb => {
            cb({
              eventType: "executionReport",
              orderId: "1",
              commissionAsset: "BNB",
              orderStatus: "FILLED"
            });
          })
        }
      }));

      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.002
        })
      ).resolves.not.toThrow();
    });

    const getOrderFilledError = jest.fn(() => {
      const error = new Error("Anything other than order does not exist");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).code = ErrorCodes.UNKNOWN;
      throw error;
    });

    test("get order status throws error", async () => {
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        accountInfo: mockAccountInfo,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        orderTest: jest.fn(),
        getOrder: getOrderFilledError,
        prices: bnbbtcPrices,
        ws: {
          trades: jest.fn(),
          user: jest.fn()
        }
      }));

      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.002
        })
      ).rejects.toThrow();
    });

    test("buy order with cancel price", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.002,
          cancelPrice: 0.001
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalled();
      expect(mockCancel).not.toBeCalled();
    });

    test("buy order cancels when cancel price hit", async () => {
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        accountInfo: mockAccountInfo,
        cancelOrder: mockCancel,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        orderTest: jest.fn(),
        getOrder: jest.fn(() => Promise.resolve({ status: "NEW" })),
        prices: bnbbtcPrices,
        ws: {
          trades: jest.fn((symbol, cb) => {
            cb({ symbol, price: "0.001" });
          }),
          user: jest.fn()
        }
      }));

      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.002,
          cancelPrice: 0.001
        })
      ).rejects.toThrow("Order CANCELED");
      expect(mockCancel).toBeCalledWith({ symbol: "BNBBTC", orderId: "1" });
    });

    test("buy order canceled manually", async () => {
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        accountInfo: mockAccountInfo,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        orderTest: jest.fn(),
        prices: bnbbtcPrices,
        ws: {
          trades: jest.fn(),
          user: jest.fn(cb => {
            cb({
              eventType: "executionReport",
              orderId: "1",
              orderStatus: "CANCELED"
            });
          })
        }
      }));

      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.001
        })
      ).rejects.toThrow("Order CANCELED");
      expect(mockOrder).toBeCalled();
      expect(mockCancel).not.toBeCalled();
    });
  });

  describe("sell orders", () => {
    test("stop order", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          stopPrice: 0.001
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "1.00",
        price: expect.anything(),
        newOrderRespType: "FULL",
        stopPrice: "0.0010000",
        type: "STOP_LOSS_LIMIT"
      });
    });

    test("stop order with stop limit price", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          stopPrice: 0.002,
          stopLimitPrice: 0.001
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "1.00",
        price: "0.0010000",
        newOrderRespType: "FULL",
        stopPrice: "0.0020000",
        type: "STOP_LOSS_LIMIT"
      });
    });

    test("target order", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          targetPrice: 0.003
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "1.00",
        price: "0.0030000",
        type: "LIMIT"
      });
    });

    test("one-cancels-the-other order", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          stopPrice: 0.001,
          targetPrice: 0.003
        })
      ).resolves.not.toBeDefined();
      expect(mockOrderOco).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "1.00",
        price: "0.0030000",
        stopPrice: "0.0010000",
        stopLimitPrice: expect.anything()
      });
    });

    test("one-cancels-the-other order with scale out", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 3,
          stopPrice: 0.001,
          targetPrice: 0.003,
          scaleOutAmount: 1
        })
      ).resolves.not.toBeDefined();
      expect(mockOrderOco).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "1.00",
        price: "0.0030000",
        stopPrice: "0.0010000",
        stopLimitPrice: expect.anything()
      });
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "2.00",
        price: expect.anything(),
        newOrderRespType: "FULL",
        stopPrice: "0.0010000",
        type: "STOP_LOSS_LIMIT"
      });
    });
  });

  describe("buy and sell orders", () => {
    test("buy and stop order", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.002,
          stopPrice: 0.001
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "BUY",
        quantity: "1.00",
        price: "0.0020000",
        type: "LIMIT"
      });
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "1.00",
        price: expect.anything(),
        newOrderRespType: "FULL",
        stopPrice: "0.0010000",
        type: "STOP_LOSS_LIMIT"
      });
    });

    test("buy and target order", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.002,
          targetPrice: 0.003
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "BUY",
        quantity: "1.00",
        price: "0.0020000",
        type: "LIMIT"
      });
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "1.00",
        price: "0.0030000",
        type: "LIMIT"
      });
    });

    test("buy and target order with scale out", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.002,
          targetPrice: 0.003,
          scaleOutAmount: 0.5
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "BUY",
        quantity: "1.00",
        price: "0.0020000",
        type: "LIMIT"
      });
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "0.50",
        price: "0.0030000",
        type: "LIMIT"
      });
    });

    test("sell amount adjusted when nonBnbFees option used", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 10,
          buyPrice: 0.002,
          stopPrice: 0.001,
          nonBnbFees: true
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "9.99",
        price: expect.anything(),
        newOrderRespType: "FULL",
        stopPrice: "0.0010000",
        type: "STOP_LOSS_LIMIT"
      });
    });

    test("sell amount adjusted when non BNB commission asset in buy response", async () => {
      const orderWithNonBnbCommission = jest.fn(() => ({
        orderId: "1",
        status: "FILLED",
        fills: [{ commissionAsset: "BTC" }]
      }));
      binance.default.mockImplementation(() => ({
        avgPrice: btcusdtAvgPrice,
        exchangeInfo: btcusdtExchangeInfo,
        order: orderWithNonBnbCommission,
        orderTest: jest.fn(),
        prices: btcusdtPrices,
        tradeFee: jest.fn(() => ({
          tradeFee: [
            {
              symbol: "BTCUSDT",
              maker: 0.001,
              taker: 0.001
            }
          ]
        }))
      }));

      await expect(
        binanceOco({
          pair: "BTCUSDT",
          amount: 1,
          buyPrice: 0,
          stopPrice: 4000
        })
      ).resolves.not.toBeDefined();
      expect(orderWithNonBnbCommission).toBeCalledWith({
        symbol: "BTCUSDT",
        side: "SELL",
        quantity: "0.999000",
        price: expect.anything(),
        newOrderRespType: "FULL",
        stopPrice: "4000.00",
        type: "STOP_LOSS_LIMIT"
      });
    });

    test("sell amount adjusted when non BNB commission asset in execution update", async () => {
      binance.default.mockImplementation(() => ({
        accountInfo: mockAccountInfo,
        avgPrice: btcusdtAvgPrice,
        exchangeInfo: btcusdtExchangeInfo,
        order: mockOrder,
        orderTest: jest.fn(),
        prices: btcusdtPrices,
        tradeFee: jest.fn(() => ({
          tradeFee: [
            {
              symbol: "BTCUSDT",
              maker: 0.001,
              taker: 0.001
            }
          ]
        })),
        ws: {
          trades: jest.fn(),
          user: jest.fn(cb => {
            cb({
              eventType: "executionReport",
              orderId: "1",
              commissionAsset: "BTC",
              orderStatus: "FILLED"
            });
          })
        }
      }));

      await expect(
        binanceOco({
          pair: "BTCUSDT",
          amount: 1,
          buyPrice: 5000,
          stopPrice: 4000
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BTCUSDT",
        side: "SELL",
        quantity: "0.999000",
        price: expect.anything(),
        newOrderRespType: "FULL",
        stopPrice: "4000.00",
        type: "STOP_LOSS_LIMIT"
      });
    });

    test("buy and one-cancels-the-other order", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 1,
          buyPrice: 0.002,
          stopPrice: 0.001,
          targetPrice: 0.003
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "BUY",
        quantity: "1.00",
        price: "0.0020000",
        type: "LIMIT"
      });
      expect(mockOrderOco).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "1.00",
        price: "0.0030000",
        stopPrice: "0.0010000",
        stopLimitPrice: expect.anything()
      });
    });

    test("buy and one-cancels-the-other order with scale out", async () => {
      await expect(
        binanceOco({
          pair: "BNBBTC",
          amount: 3,
          buyPrice: 0.002,
          stopPrice: 0.001,
          targetPrice: 0.003,
          scaleOutAmount: 1
        })
      ).resolves.not.toBeDefined();
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "BUY",
        quantity: "3.00",
        price: "0.0020000",
        type: "LIMIT"
      });
      expect(mockOrderOco).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "1.00",
        price: "0.0030000",
        stopPrice: "0.0010000",
        stopLimitPrice: expect.anything()
      });
      expect(mockOrder).toBeCalledWith({
        symbol: "BNBBTC",
        side: "SELL",
        quantity: "2.00",
        price: expect.anything(),
        newOrderRespType: "FULL",
        stopPrice: "0.0010000",
        type: "STOP_LOSS_LIMIT"
      });
    });
  });

  describe("exit hook", () => {
    test("exit hook: order placed not filled - cancels order", done => {
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        accountInfo: mockAccountInfo,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        orderOco: mockOrderOco,
        cancelOrder: mockCancel,
        orderTest: jest.fn(),
        getOrder: jest.fn(() => Promise.resolve({ status: "NEW" })),
        prices: bnbbtcPrices,
        ws: {
          trades: jest.fn(),
          user: jest.fn()
        }
      }));

      let exitHook = (cancel: Function) => {
        // this must work asychronously hence the wait
        setImmediate(async () => {
          await cancel();
          expect(mockCancel).toBeCalledWith({ symbol: "BNBBTC", orderId: "1" });
          done();
        });
      };

      expect(
        binanceOco(
          {
            pair: "BNBBTC",
            amount: 1,
            buyPrice: 0.002,
            stopPrice: 0.001,
            targetPrice: 0.003
          },
          exitHook
        )
      ).resolves.not.toBeDefined();
    });

    test("exit hook: immediate order fill - do not cancel stop order", done => {
      const mockOrder = jest.fn(() => ({
        orderId: "1",
        status: "FILLED",
        fills: [
          {
            commissionAsset: "BNB"
          }
        ]
      }));

      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        accountInfo: mockAccountInfo,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        orderOco: mockOrderOco,
        cancelOrder: mockCancel,
        orderTest: jest.fn(),
        getOrder: jest.fn(() => Promise.resolve({ status: "NEW" })),
        prices: bnbbtcPrices,
        tradeFee: jest.fn(() => ({
          tradeFee: [
            {
              symbol: "BNBBTC",
              maker: 0.001,
              taker: 0.001
            }
          ]
        })),
        ws: {
          trades: jest.fn(),
          user: jest.fn()
        }
      }));

      let exitHook = (cancel: Function) => {
        // this must work asychronously hence the wait
        setImmediate(async () => {
          await cancel();
          expect(mockCancel).not.toBeCalled();
          done();
        });
      };

      expect(
        binanceOco(
          {
            pair: "BNBBTC",
            amount: 1,
            buyPrice: 0.002,
            stopPrice: 0.001,
            targetPrice: 0.003
          },
          exitHook
        )
      ).resolves.not.toBeDefined();
    });

    test("exit hook: order filled via order status - do not cancel stop order", done => {
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        accountInfo: mockAccountInfo,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        orderOco: mockOrderOco,
        cancelOrder: mockCancel,
        orderTest: jest.fn(),
        getOrder: jest.fn(() => Promise.resolve({ status: "FILLED" })),
        prices: bnbbtcPrices,
        ws: {
          trades: jest.fn(),
          user: jest.fn()
        }
      }));

      let exitHook = (cancel: Function) => {
        // this must work asychronously hence the wait
        setImmediate(async () => {
          await cancel();
          expect(mockCancel).not.toBeCalled();
          done();
        });
      };

      expect(
        binanceOco(
          {
            pair: "BNBBTC",
            amount: 1,
            buyPrice: 0.002,
            stopPrice: 0.001,
            targetPrice: 0.003
          },
          exitHook
        )
      ).resolves.not.toBeDefined();
    });

    test("exit hook: non market order filled via user update - do not cancel stop order", done => {
      // this is a fill via user data
      binance.default.mockImplementation(() => ({
        avgPrice: bnbbtcAvgPrice,
        accountInfo: mockAccountInfo,
        exchangeInfo: bnbbtcExchangeInfo,
        order: mockOrder,
        orderOco: mockOrderOco,
        cancelOrder: mockCancel,
        orderTest: jest.fn(),
        getOrder: jest.fn(() => Promise.resolve({ status: "NEW" })),
        prices: bnbbtcPrices,
        ws: {
          trades: jest.fn(),
          user: jest.fn(cb => {
            cb({
              eventType: "executionReport",
              orderId: "1",
              commissionAsset: "BNB",
              orderStatus: "FILLED"
            });
          })
        }
      }));

      let exitHook = (cancel: Function) => {
        // this must work asychronously hence the wait
        setImmediate(async () => {
          await cancel();
          expect(mockCancel).not.toBeCalled();
          done();
        });
      };

      expect(
        binanceOco(
          {
            pair: "BNBBTC",
            amount: 1,
            buyPrice: 0.002,
            stopPrice: 0.001,
            targetPrice: 0.003
          },
          exitHook
        )
      ).resolves.not.toBeDefined();
    });
  });
});
