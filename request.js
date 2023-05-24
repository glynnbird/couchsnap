const http = require('http')
const https = require('https')

// make a generic HTTP/HTTPS request
// opts.url - the URL to call
// opts.headers - object containing headers to supply
// opts.method - the HTTP method
// opts.body - the HTTP body (for POST/PUT/DELETE)
const requestStream = async (opts) => {

  return new Promise((resolve, reject) => {

    let parsedURL
    try {
      parsedURL = new URL(opts.url)
    } catch (e) {
      return reject(new Error('invalid URL'))
    }
    opts.method = opts.method ? opts.method.toUpperCase() : 'GET'
    opts.headers = opts.headers ? opts.headers : { 'Content-type': 'application/json' }
    if (parsedURL.username && parsedURL.password) {
      const creds = Buffer.from('admin:admin').toString('base64')
      opts.headers.Authorization = `Basic ${creds}`
    }

    const options = {
      hostname: parsedURL.hostname,
      port: parseInt(parsedURL.port),
      path: parsedURL.pathname + (parsedURL.search ? parsedURL.search : ''),
      method: opts.method,
      headers: opts.headers
    }
    const agent = parsedURL.protocol === 'http:' ? http : https

    const req = agent.request(options, (res) => {
      res.setEncoding('utf8')
      return resolve (res)
    })
    req.on('error', (e) => {
      return reject(e)
    })
    if (opts.body) {
      req.write(opts.body)
    }
    req.end()
  })
}

const requestJSON = async (opts) => {
  return new Promise(async (resolve, reject) => {
    const s = await requestStream(opts)
    let j = ''
    s.on('data', (chunk) => {
      j += chunk
    })
    s.on('end', () => {
      return resolve(JSON.parse(j))
    })
  })
}
 
module.exports = {
  requestStream,
  requestJSON
}
