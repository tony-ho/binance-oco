#!/usr/bin/env node

import { binanceOco } from "./binance-oco";
require("dotenv").config();
require("debug").enable("binance-oco");

const { argv } = require("yargs")
  .usage("Usage: binance-oco")
  .example(
    "binance-oco -p BNBBTC -a 1 -b 0.002 -s 0.001 -t 0.003",
    "Place a buy order for 1 BNB @ 0.002 BTC. Once filled, place a stop-limit sell @ 0.001 BTC. If a price of 0.003 BTC is reached, cancel stop-limit order and place a limit sell @ 0.003 BTC."
  )
  // '-p <tradingPair>'
  .demand("pair")
  .alias("p", "pair")
  .describe("p", "Set trading pair eg. BNBBTC")
  // '-a <amount>'
  .demand("amount")
  .number("a")
  .alias("a", "amount")
  .describe("a", "Set amount to buy/sell")
  // '-b <buyPrice>'
  .number("b")
  .alias("b", "buy")
  .alias("b", "e")
  .alias("b", "entry")
  .describe("b", "Set buy price (0 for market buy)")
  // '-B <buyLimitPrice>'
  .number("B")
  .alias("B", "buy-limit")
  .alias("B", "E")
  .alias("B", "entry-limit")
  .describe(
    "B",
    "Set buy stop-limit order limit price. If not set, market buy will be attempted at stop price."
  )
  // '-s <stopPrice>'
  .number("s")
  .alias("s", "stop")
  .describe("s", "Set stop-limit order stop price")
  // '-l <stopLimitPrice>'
  .number("l")
  .alias("l", "limit")
  .alias("l", "stop-limit")
  .describe(
    "l",
    "Set sell stop-limit order limit price. If not set, market sell will be attempted at stop price."
  )
  // '-t <targetPrice>'
  .number("t")
  .alias("t", "target")
  .describe("t", "Set target limit order sell price")
  // '-c <cancelPrice>'
  .number("c")
  .alias("c", "cancel")
  .describe("c", "Set price at which to cancel buy order")
  // '-S <scaleOutAmount>'
  .number("S")
  .alias("S", "scale-out-amount")
  .alias("S", "A")
  .describe(
    "S",
    "Set amount to sell (scale out) at target price (if different from amount)"
  )
  // '--non-bnb-fees'
  .boolean("F")
  .alias("F", "non-bnb-fees")
  .describe(
    "F",
    "Calculate stop/target sell amounts assuming not paying fees using BNB"
  )
  .default("F", false);

const {
  p: pair,
  a: amount,
  b: buyPrice,
  B: buyLimitPrice,
  s: stopPrice,
  l: stopLimitPrice,
  t: targetPrice,
  c: cancelPrice,
  S: scaleOutAmount,
  F: nonBnbFees
} = argv;

const debug = require("debug")("binance-oco");

(async (): Promise<void> => {
  try {
    await binanceOco({
      pair: pair.toUpperCase(),
      amount,
      buyPrice,
      buyLimitPrice,
      stopPrice,
      stopLimitPrice,
      targetPrice,
      cancelPrice,
      scaleOutAmount,
      nonBnbFees
    });
    process.exit(0);
  } catch (err) {
    debug(err.message);
    process.exit(1);
  }
})();
