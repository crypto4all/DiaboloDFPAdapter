const createRequest = require('./index_old').createRequest
const createRequest2 = require('./index').createRequest

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const app = express()
const port = process.env.EA_PORT || 8080

app.use(bodyParser.json())

app.use(cors())

app.get('/', (req, res) => {
  createRequest2(req.body, (status, result) => {
    console.log('Result: ', result)
    res.status(status).json(result)
  })
})

app.listen(port, () => console.log(`Listening on port ${port}!`))
