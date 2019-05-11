# Binance Auto Stop & Target OCO (One-Cancels-the-Other)

A command line tool for placing conditional stop-limit, limit, and OCO (One-Cancels-the-Other) sell orders on [Binance](https://www.binance.com/?ref=17067303) cryptocurrency exchange.

## Installation

Prerequisites: [Node.js](https://nodejs.org/en/)

The easiest way to get started is to install `binance-oco` globally. Open a terminal/command prompt and run the command below.
**Note:** You may need to use `sudo` (for macOS, *nix etc), or run your command shell as Administrator (for Windows) to do this.
```
npm install -g binance-oco
```

This will add the `binance-oco` command to your system path, allowing it to be run from any folder.

## Configuration

Create a file called `.env` in the folder from where you want to run `binance-oco`, and add your [Binance API key](https://support.binance.com/hc/en-us/articles/360002502072-How-to-create-API) in the following format. Replace `BINANCE_API_KEY` with your API key and `BINANCE_API_SECRET` with your API secret.
<pre>
APIKEY=<b>BINANCE_API_KEY</b>
APISECRET=<b>BINANCE_API_SECRET</b>
</pre>

## Usage

```
binance-oco
```

### Market and limit buy orders

Place a market buy order for 1 BNB:
```
binance-oco -p BNBBTC -a 1 -b 0
```

For non market orders, `binance-oco` determines whether to place a limit or stop-limit buy order based on the current price.

eg. *If the current BNBBTC price is at or above 0.002 BTC,* place a limit buy order for 1 BNB @ 0.002 BTC. *If the current BNBBTC price is below 0.002 BTC,* place a stop-limit buy for 1 BNB with stop price @ 0.002 BTC.
```
binance-oco -p BNBBTC -a 1 -b 0.002
```

*If the current BNBBTC price is below 0.002 BTC,* place a stop-limit buy for 1 BNB with stop price @ 0.002 BTC, and limit price @ 0.0025 BTC.
```
binance-oco -p BNBBTC -a 1 -b 0.002 -B 0.0025
```

### Limit prices for stop-limit orders

If specific buy/sell limit prices aren't specified with the `-l` or `-B`/`-E` options respectively, `binance-oco` sets the limit price for stop-limit orders to emulate a *stop market* order ie. buy/sell at market price once the stop price has been hit.

To achieve this, limit prices are calculated as follows:
- Buy limit price set to maximum allowed by available balance and Binance PERCENT_PRICE trading rule
- Sell limit price set to minimum allowed by Binance MIN_PRICE, MIN_NOTIONAL and PERCENT_PRICE trading rules

Binance will still fill orders at the best price available, but order details may show a very low sell or very high buy price.

See [How to use Stop-Limit Function](https://support.binance.com/hc/en-us/articles/115003372072-How-to-use-Stop-Limit-Function) for information on stop-limit orders, and the [Binance Trading Rules](https://support.binance.com/hc/en-us/articles/115000594711-Trading-Rule) for details on Binance trading rules.

### Stop-limit and limit sell orders

Place a stop-limit sell for 1 BNB @ 0.001 BTC:
```
binance-oco -p BNBBTC -a 1 -s 0.001
```

Place a stop-limit sell for 1 BNB with stop price @ 0.002 BTC, and limit price @ 0.001 BTC.
```
binance-oco -p BNBBTC -a 1 -s 0.002 -l 0.001
```

Place a limit sell for 1 BNB @ 0.003 BTC:
```
binance-oco -p BNBBTC -a 1 -t 0.003
```

### Conditional sell orders

Place a buy order for 1 BNB @ 0.002 BTC. Once filled, place a stop-limit sell @ 0.001 BTC:
```
binance-oco -p BNBBTC -a 1 -b 0.002 -s 0.001
```

Place a buy order for 1 BNB @ 0.002 BTC. Once filled, place a limit sell @ 0.003 BTC:
```
binance-oco -p BNBBTC -a 1 -b 0.002 -t 0.003
```

### One-Cancels-the-Other (OCO) sell orders

Place a stop-limit sell for 1 BNB @ 0.001 BTC. If a price of 0.003 BTC is reached, cancel stop-limit order and place a limit sell @ 0.003 BTC:
```
binance-oco -p BNBBTC -a 1 -s 0.001 -t 0.003
```

Place a buy order for 1 BNB @ 0.002 BTC. Once filled, place a stop-limit sell @ 0.001 BTC. If a price of 0.003 BTC is reached, cancel stop-limit order and place a limit sell @ 0.003 BTC:
```
binance-oco -p BNBBTC -a 1 -b 0.002 -s 0.001 -t 0.003
```

Place a buy order for 2 BNB @ 0.002 BTC. Once filled, place:
- a stop-limit sell for the scale out amount of 1 BNB @ 0.001 BTC, and
- a stop-limit sell for the remaining 1 BNB @ 0.001 BTC

If a price of 0.003 BTC is reached, cancel first stop-limit order and place a limit sell for the scale out amount 1 BNB @ 0.003 BTC. This process is referred to as 'scaling out' of a position.
The second stop-limit sell for the remaining 1 BNB is left in place.
```
binance-oco -p BNBBTC -a 2 -b 0.002 -s 0.001 -t 0.003 -S 1
```
