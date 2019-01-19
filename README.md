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

Place a limit buy order for 1 BNB @ 0.002 BTC:
```
binance-oco -p BNBBTC -a 1 -b 0.002
```

Place a stop-limit buy for 1 BNB with stop price @ 0.001 BTC, and limit price @ 0.002 BTC. See [How to use Stop-Limit Function](https://support.binance.com/hc/en-us/articles/115003372072-How-to-use-Stop-Limit-Function).
```
binance-oco -p BNBBTC -a 1 -b 0.001 -B 0.002
```

### Stop-limit and limit sell orders

Place a stop-limit sell for 1 BNB @ 0.001 BTC:
```
binance-oco -p BNBBTC -a 1 -s 0.001
```

Place a stop-limit sell for 1 BNB with stop price @ 0.002 BTC, and limit price @ 0.001 BTC. See [How to use Stop-Limit Function](https://support.binance.com/hc/en-us/articles/115003372072-How-to-use-Stop-Limit-Function).
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

### One-Cancels-the-Other (OCO) sell orders

Place a buy order for 1 BNB @ 0.002 BTC. Once filled, place a stop-limit sell @ 0.001 BTC. If a price of 0.003 BTC is reached, cancel stop-limit order and place a limit sell @ 0.003 BTC:
```
binance-oco -p BNBBTC -a 1 -b 0.002 -s 0.001 -t 0.003
```

Place a buy order for 2 BNB @ 0.002 BTC. Once filled, place a stop-limit sell @ 0.001 BTC. If a price of 0.003 BTC is reached, cancel stop-limit order and place a limit sell for 1 BNB @ 0.003 BTC, and a stop-limit sell for the remaining 1 BNB @ 0.001 BTC. This process is referred to as 'scaling out' of a position:
```
binance-oco -p BNBBTC -a 2 -b 0.002 -s 0.001 -t 0.003 -S 1
```
