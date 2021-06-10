const Nano = require('nano')
const URL = require('url')

// download a whole changes feed in one long HTTP request
const spoolChanges = async (db, opts) => {
  // return a Promise
  let numChanges = 0
  return new Promise((resolve, reject) => {
    db.changesReader.spool({ since: opts.since, includeDocs: true })
      .on('batch', async (batch) => {
        for (const change of batch) {
          console.log(JSON.stringify(change.doc))
        }
        numChanges += batch.length
      }).on('end', (lastSeq) => {
        // pass back the last known sequence token
        resolve({ lastSeq: lastSeq, numChanges: numChanges })
      }).on('error', reject)
  })
}

// start spooling and monitoring the changes feed
const start = async (opts) => {
  // override defaults
  const defaults = {
    url: 'http://localhost:5984',
    since: '0'
  }
  opts = Object.assign(defaults, opts)

  // configure nano
  const nano = Nano({ url: opts.url })
  const db = nano.db.use(opts.database)

  // spool changes
  const status = await spoolChanges(db, opts)
  status.db = opts.database
  status.timestamp = new Date().toISOString()
  const u = new URL.URL(opts.url)
  status.hostname = u.hostname
  status._meta = 'meta'

  // write meta data
  console.log(JSON.stringify(status))
  process.exit(0)
}

module.exports = {
  start: start
}
