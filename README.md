# Binance Auto Stop & Target OCO (One-Cancels-the-Other)

A command line tool for placing conditional stop-limit, limit, and OCO (One-Cancels-the-Other) sell orders on [Binance](https://www.binance.com/?ref=17067303).

## Installation

Prerequisites: [Node.js](https://nodejs.org/en/)

Download and unzip the latest release from [here](https://github.com/tony-ho/binance-oco/releases)

Open a terminal/command prompt in the downloaded folder and run the following command:
```
npm install
```

## Configuration

Create a file called `.env` in the same folder as `binance-oco.js` with your [Binance API key](https://support.binance.com/hc/en-us/articles/360002502072-How-to-create-API) in the following format:
```
APIKEY={Binance API Key}
APISECRET={Binance Secret Key}
```

## Usage

```
node binance-oco
```

### Market and limit buy orders

Place a market buy order for 1 BNB:
```
node binance-oco -p BNBBTC -a 1 -b 0
```

Place a limit buy order for 1 BNB @ 0.002 BTC:
```
node binance-oco -p BNBBTC -a 1 -b 0.002
```

### Stop-limit and limit sell orders

Place a stop-limit sell for 1 BNB @ 0.001 BTC:
```
node binance-oco -p BNBBTC -a 1 -s 0.001
```

Place a limit sell for 1 BNB @ 0.003 BTC:
```
node binance-oco -p BNBBTC -a 1 -t 0.003
```

### Conditional sell orders

Place a buy order for 1 BNB @ 0.002 BTC. Once filled, place a stop-limit sell @ 0.001 BTC:
```
node binance-oco -p BNBBTC -a 1 -b 0.002 -s 0.001
```

### One-Cancels-the-Other (OCO) sell orders

Place a buy order for 1 BNB @ 0.002 BTC. Once filled, place a stop-limit sell @ 0.001 BTC. If a price of 0.003 BTC is reached, cancel stop-limit order and place a limit sell @ 0.003 BTC:
```
node binance-oco -p BNBBTC -a 1 -b 0.002 -s 0.001 -t 0.003
```
