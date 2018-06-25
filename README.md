# Binance Auto Stop & Target OCO (One-Cancels-the-Other)

A command line tool for placing conditional stop-limit, limit, and OCO (One-Cancels-the-Other) sell orders on [Binance](https://www.binance.com/?ref=17067303).

## Installation

Prerequisites: [Node.js](https://nodejs.org/en/)

Open a terminal/command prompt and run the following command:
```
npm install binance-oco
```

## Configuration

Create a file called `.env` in the folder from where you'll be running `binance-oco`, and add your [Binance API key](https://support.binance.com/hc/en-us/articles/360002502072-How-to-create-API) in the following format:
```
APIKEY={Binance API Key}
APISECRET={Binance Secret Key}
```

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

### Stop-limit and limit sell orders

Place a stop-limit sell for 1 BNB @ 0.001 BTC:
```
binance-oco -p BNBBTC -a 1 -s 0.001
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
