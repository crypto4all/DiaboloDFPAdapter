const { Requester, Validator } = require('@chainlink/external-adapter')
const Binance = require('node-binance-api')
const KrakenClient = require('./kraken')
const { RestClient } = require('ftx-api')
const FTXRest = require('ftx-api-rest');
const dotenv = require('dotenv')

dotenv.config()

const binance = new Binance().options({
  APIKEY: 'Am9MbAEFoFq00JaAI1UNb7NRfPieWU60Q7EE96WykIHXoxBLyHDBFeHMtL4Xb6B0',
  APISECRET: 'cMRCqfxbxehmXFW5Av1wsD5d43rSYvqmSZTfCbFrylbreqdcJQTbEU9FxzYKVl2q'
})

const ftxClient = new RestClient(
  '1lzSapilHUmv7SWBG3P_dTpHBzmWLgF1DuxyFgM-',
  'wlLVrXENVlyqzCB2QEi7qqsijrX8veRu_xYeAkkp'
)

const ftxApi = new FTXRest({
  key: '1lzSapilHUmv7SWBG3P_dTpHBzmWLgF1DuxyFgM-',
  secret: 'wlLVrXENVlyqzCB2QEi7qqsijrX8veRu_xYeAkkp'
})

const krakenApi = new KrakenClient(
  process.env.KRAKEN_API_KEY,
  process.env.KRAKEN_API_SECRET
)

// Define custom parameters to be used by the adapter.
const customParams = {
  base: [],
  balance: ['username', 'BTC', 'USD', 'ETH'],
  endpoint: false
}

const createRequest2 = async (input, callback) => {
  // The Validator helps you validate the Chainlink request data
  const validator = new Validator(callback, input, customParams)
  const jobRunID = validator.validated.id

  let totalUsdBalance = 0

  try {
    // fetch binance balance
    const binanceAccountData = await binance.balance()
    const binancePrices = await binance.prices()

    const binanceTotalUsdBalance = Object.keys(binanceAccountData)
      .filter(symbol => parseFloat(binanceAccountData[symbol].available) > 0)
      .map(symbol => {
        const currencyPrice = symbol.includes('USD') ? 1 : (binancePrices[`${symbol}USDT`] ? parseFloat(binancePrices[`${symbol}USDT`]) : 0)
        return {
          symbol,
          amount: parseFloat(binanceAccountData[symbol].available),
          price: currencyPrice
        }
      })
      .reduce((sum, current) => {
        return sum + (current.amount * current.price)
      }, 0)

    totalUsdBalance += binanceTotalUsdBalance

    // fetch FTX account balance
    const ftxBalanceData = await ftxApi.request({
      method: 'GET',
      path: '/wallet/all_balances'
    })

    console.log(ftxBalanceData);
    if (ftxBalanceData.success) {
      const ftxUsdValue = ftxBalanceData.result.main.reduce((sum, item) => {
        return sum + item.usdValue
      }, 0)
      totalUsdBalance += ftxUsdValue
    }

    // fetch Kraken account balance
    // const krakenBalanceData = await krakenApi.api('Ticker', { pair: 'XXBTZUSD' })
    // console.log(krakenBalanceData)

    callback(200, Requester.success(jobRunID, {
      data: {
        result: totalUsdBalance
      }
    }))
  } catch (error) {
    console.log(error)
    callback(500, Requester.errored(jobRunID, error))
  }
}

// This is a wrapper to allow the function to work with
// GCP Functions
exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data)
  })
}

// This is a wrapper to allow the function to work with
// AWS Lambda
exports.handler = (event, context, callback) => {
  createRequest2(event, (statusCode, data) => {
    callback(null, data)
  })
}

// This is a wrapper to allow the function to work with
// newer AWS Lambda implementations
exports.handlerv2 = (event, context, callback) => {
  createRequest2(JSON.parse(event.body), (statusCode, data) => {
    callback(null, {
      statusCode: statusCode,
      body: JSON.stringify(data),
      isBase64Encoded: false
    })
  })
}

// This allows the function to be exported for testing
// or for running in express
module.exports.createRequest = createRequest2
