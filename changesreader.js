const jsonpour = require('jsonpour')
const axios = require('axios')
const changeProcessor = require('./changeProcessor.js')

const changesreader = async (url, db, since, ws) => {
  return new Promise(async (resolve, reject) => {
    let response, lastSeq

    // get lastSeq
    const seqReq = {
      baseURL: url,
      url: `/${db}`,
      method: 'get'
    }
    try {
      const response = await axios.request(seqReq)
      lastSeq = response.data.update_seq
    } catch(e) {
      return reject(e)
    }
  
    // spool changes
    const req = {
      baseURL: url,
      url: `/${db}/_changes`,
      method: 'get',
      params: {
        since: since,
        include_docs: true,
        seq_interval: 10000
      },
      responseType: 'stream'
    }
    response = await axios.request(req)
    response.data
      .on('end', () => {
        resolve({ since: lastSeq })
      })
      .on('error', (e) => {
        reject(e)
      })
      .pipe(jsonpour.parse('results.*.doc'))
      .pipe(changeProcessor())
      .pipe(ws)
  })
}

module.exports = changesreader