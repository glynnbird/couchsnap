const { URL } = require('url')
const querystring = require('querystring')
const stream = require('stream')
const Readable = stream.Readable
const jsonpour = require('jsonpour')
const undici = require('undici')
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
      method: 'get',
      headers: h
    }
    u = `${plainURL}/${db}`
    try {
      response = await undici.fetch(u, opts)
      const j = await response.json()
      lastSeq = j.update_seq
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
    u = `${plainURL}/${db}/_changes?${qs}`
    response = await undici.fetch(u, opts)

    const readableWebStream = response.body
    const readableNodeStream = Readable.fromWeb ? Readable.fromWeb(readableWebStream) : Readable.from(readableWebStream)
    readableNodeStream
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
