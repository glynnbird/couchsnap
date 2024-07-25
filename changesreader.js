const { URL } = require('url')
const { pipeline } = require('node:stream/promises')
const querystring = require('querystring')
const stream = require('stream')
const Readable = stream.Readable
const jsonpour = require('jsonpour')
const changeProcessor = require('./changeProcessor.js')
const h = {
  'content-type': 'application/json'
}

const changesreader = async (url, db, since, ws, deletions) => {
  let response, j, lastSeq, opts, u

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
  try {
    u = `${plainURL}/${db}`
    response = await fetch(u, opts)
    j = await response.json()
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
  response = await fetch(u, opts)
  await pipeline(
    Readable.fromWeb(response.body),
    jsonpour.parse('results.*.doc'),
    changeProcessor(deletions),
    ws
  )
  return { since: lastSeq }

  // response
  //   .on('error', (e) => {
  //     reject(e)
  //   })
  //   .pipe(jsonpour.parse('results.*.doc'))
  //   .pipe(changeProcessor(deletions))
  //   .pipe(ws)
  //   .on('finish', () => {
  //     resolve()
  //   })

}

module.exports = changesreader
