const Nano = require('nano')
const fs = require('fs')

// download a whole changes feed in one long HTTP request
const spoolChanges = async (db, opts) => {
  // return a Promise
  let numChanges = 0
  return new Promise((resolve, reject) => {
    db.changesReader.spool({ since: opts.since, includeDocs: true, fastChanges: true })
      .on('batch', async (batch) => {
        for (const change of batch) {
          // ignore deletions
          if (change.doc._deleted) {
            continue
          }
          // remove the _rev
          delete change.doc._rev
          opts.ws.write(JSON.stringify(change.doc) + '\n')
          numChanges++
        }
      }).on('end', (lastSeq) => {
        // pass back the last known sequence token
        resolve({ since: lastSeq, numChanges })
      }).on('error', reject)
  })
}

// calculate the filename where metadata is stored
const calculateMetaFilename = (database) => {
  return `${database}-meta.json`
}

// load a previous meta file for this database
const loadMeta = async (database) => {
  const filename = calculateMetaFilename(database)
  let meta = {
    since: 0,
    db: database
  }
  try {
    meta = JSON.parse(fs.readFileSync(filename, { encoding: 'utf8' }))
  } catch (e) {
    // file does not exist or is invalid
  }
  return meta
}

// just get the numeric part of the sequence token
const shortenSince = (since) => {
  if (since === 0 || since === '0') {
    return '0'
  } else {
    return since.replace(/-.*$/, '-*****')
  }
}

const saveMeta = async (meta) => {
  const filename = calculateMetaFilename(meta.db)
  fs.writeFileSync(filename, JSON.stringify(meta), { encoding: 'utf8' })
}

// start spooling and monitoring the changes feed
const start = async (opts) => {
  // override defaults
  const defaults = {
    url: 'http://localhost:5984',
    since: 0
  }
  opts = Object.assign(defaults, opts)

  // configure nano
  const nano = Nano({ url: opts.url })
  const db = nano.db.use(opts.database)

  // load any previous meta data
  const meta = await loadMeta(opts.database)
  opts.since = meta.since
  meta.startTime = new Date().toISOString()
  console.log(`spooling changes for ${meta.db} since ${shortenSince(meta.since)}`)

  // create new output file
  const outputFilename = `${meta.db}-snapshot-${meta.startTime}.jsonl`
  console.log('Writing to new output file', outputFilename)
  opts.ws = fs.createWriteStream(outputFilename)

  // spool changes
  const status = await spoolChanges(db, opts)
  opts.ws.end()

  // write new meta data
  meta.endTime = new Date().toISOString()
  meta.since = status.since
  meta.numChanges = status.numChanges
  await saveMeta(meta)

  // die
  process.exit(0)
}

module.exports = {
  start
}
