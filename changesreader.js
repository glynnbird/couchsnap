const EventEmitter = require('events').EventEmitter
const stream = require('stream')
const EVENT_BATCH = 'batch'
const EVENT_ERROR = 'error'

// streaming line breaker
const liner = () => {
  const liner = new stream.Transform({ objectMode: true })

  liner._transform = function (chunk, encoding, done) {
    let data = chunk.toString('utf8')
    if (this._lastLineData) {
      data = this._lastLineData + data
      this._lastLineData = null
    }

    const lines = data.split(/\s*\n/)
    this._lastLineData = lines.splice(lines.length - 1, 1)[0]
    lines.forEach(this.push.bind(this))
    done()
  }

  liner._flush = function (done) {
    this.push(this._lastLineData)
    this._lastLineData = null
    done()
  }

  return liner
}

// streaming change processor
const changeProcessor = (ee, batchSize) => {
  const changeProcessor = new stream.Transform({ objectMode: true })
  const buffer = []
  changeProcessor.lastSeq = '0'

  changeProcessor._transform = function (chunk, encoding, done) {
    // remove last char from string
    if (chunk[chunk.length - 1] === ',') {
      chunk = chunk.slice(0, -1)
    }

    try {
      const j = JSON.parse(chunk)
      buffer.push(j)
      if (buffer.length >= batchSize) {
        ee.emit(EVENT_BATCH, buffer.splice(0, batchSize))
      }
      done()
    } catch (e) {
      // look for last_seq
      const match = chunk.match(/"last_seq":(.+?)[},]/)
      if (match) {
        changeProcessor.lastSeq = JSON.parse(match[1])
      }
      done()
    }
  }

  changeProcessor._flush = function (done) {
    if (buffer.length > 0) {
      ee.emit(EVENT_BATCH, buffer.splice(0, buffer.length))
    }
    done()
  }

  return changeProcessor
}

/**
 * Monitors the changes feed (after calling .spool()) and emits events
 *  - EVENT_CHANGE - per change
 *  - EVENT_BATCH - per batch of changes
 *  - EVENT_SEQ - per change of sequence number
 *  - EVENT_ERROR - per 4xx error (except 429)
 *
 * @param {String} db - Name of the database.
 * @param {String} url - the URL of the CouchDB service
 */

const axios = require('axios')

class ChangesReader {
  // constructor
  constructor (url, db) {
    this.db = db
    this.setDefaults()
    this.url = url
  }

  // set defaults
  setDefaults () {
    this.ee = new EventEmitter()
    this.batchSize = 10000
    this.since = 'now'
    this.includeDocs = false
    this.timeout = 60000
  }

  // called to spool through changes to "now" in one long HTTP request
  async spool (opts) {
    const self = this
    self.setDefaults()
    opts = opts || {}
    Object.assign(self, opts)
    const req = {
      baseURL: self.url,
      url: `/${self.db}/_changes`,
      method: 'get',
      params: {
        since: self.since,
        include_docs: self.includeDocs,
        seq_interval: self.batchSize
      },
      responseType: 'stream'
    }
    const lin = liner()
    const cp = changeProcessor(self.ee, self.batchSize)
    const response = await axios.request(req)
    response.data.pipe(lin)
      .pipe(cp)
      .on('finish', () => {
        // the 'end' event was triggering before the last data event
        setTimeout(() => {
          self.ee.emit('end', cp.lastSeq)
        }, 10)
      })
      .on(EVENT_ERROR, (e) => {
        self.ee.emit(EVENT_ERROR, e)
      })

    return self.ee
  }
}

module.exports = ChangesReader
