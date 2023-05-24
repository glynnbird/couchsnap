const { URL } = require('url')
const querystring = require('querystring')
const jsonpour = require('jsonpour')
const request = require('./request.js')
const changeProcessor = require('./changeProcessor.js')
const h = {
  'content-type': 'application/json'
}

const changesreader = async (url, db, since, ws, deletions) => {
  return new Promise(async (resolve, reject) => {
    let response, lastSeq, opts, u

    // parse URL
    const parsed = new URL(url)
    const plainURL = parsed.origin
    if (parsed.username && parsed.password) {
      h.Authorization = 'Basic ' + Buffer.from(`${parsed.username}:${parsed.password}`).toString('base64')
    }

    // get lastSeq
    opts = {
      url: `${plainURL}/${db}`,
      method: 'get',
      headers: h
    }
    try {
      response = await request.requestJSON(opts)
      lastSeq = response.update_seq
    } catch (e) {
      return reject(e)
    }

    // spool changes
    opts = {
      method: 'get',
      headers: h
    }
    const qs = querystring.stringify({
      since,
      include_docs: true,
      seq_interval: 10000
    })
    opts.url = `${plainURL}/${db}/_changes?${qs}`
    response = await request.requestStream(opts)
    response
      .on('end', () => {
        resolve({ since: lastSeq })
      })
      .on('error', (e) => {
        reject(e)
      })
      .pipe(jsonpour.parse('results.*.doc'))
      .pipe(changeProcessor(deletions))
      .pipe(ws)
  })
}

module.exports = changesreader
