import { Transform }  from 'node:stream'
import { readFileSync, writeFileSync, createWriteStream, unlinkSync, renameSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import * as jsonpour from 'jsonpour'
import * as ccurllib from 'ccurllib'

// load package meta data
const pkg = JSON.parse(readFileSync('./package.json', { encoding: 'utf8' }))
const h = {
  'user-agent': `${pkg.name}@${pkg.version}`,
  'content-type': 'application/json'
}

// stream-processing function. Removes deleted docs, drops the
// _rev token and outputs a stringified object
const changeProcessor = function (deletions) {
  // create stream transformer
  const filter = new Transform({ objectMode: true })

  // add _transform function
  filter._transform = function (obj, encoding, done) {
    // ignore deleted docs
    if (!deletions && obj._deleted) {
      return done()
    }

    // scrub the rev token
    delete obj._rev

    // turn object into a string
    this.push(JSON.stringify(obj) + '\n')
    done()
  }
  return filter
}

// fetches the database's current update_seq then spools the changes
// feed through a streaming JSON parser to extract the docs
const changesreader = async (url, db, since, ws, deletions) => {
  let response, j, lastSeq, opts, u

  // get lastSeq
  opts = {
    method: 'get',
    headers: h,
    url: `${url}/${db}`
  }
  try {
    response = await ccurllib.request(opts)
    if (response.status >= 400) {
      throw new Error("Cannot read database")
    }
    j = response.result
    lastSeq = j.update_seq
  } catch (e) {
    return reject(e)
  }

  // spool changes
  opts.qs = {
    since,
    include_docs: true,
    seq_interval: 10000
  }
  opts.url = `${url}/${db}/_changes`
  const responseStream = await ccurllib.requestStream(opts)

  // stream pipeline
  await pipeline(
    responseStream,
    jsonpour.parse('results.*.doc'),
    changeProcessor(deletions),
    ws
  )
  return { since: lastSeq }
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
    meta = JSON.parse(readFileSync(filename, { encoding: 'utf8' }))
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

// save the latest meta data JSON
const saveMeta = async (meta) => {
  const filename = calculateMetaFilename(meta.db)
  writeFileSync(filename, JSON.stringify(meta), { encoding: 'utf8' })
}

// start spooling and monitoring the changes feed
export async function couchsnap(opts) {
  // override defaults
  const defaults = {
    url: 'http://localhost:5984',
    since: 0
  }
  opts = Object.assign(defaults, opts)

  // check URL is valid
  try {
    new URL(opts.url)
  } catch (e) {
    console.error('Invalid URL')
    process.exit(1)
  }

  // load any previous meta data
  const meta = await loadMeta(opts.database)
  opts.since = meta.since
  meta.startTime = new Date().toISOString()
  const outputFilename = `${meta.db}-snapshot-${meta.startTime}.jsonl`.replace(/:/g,"") // remove colons for compliant filenames
  const tempOutputFile = `_tmp_${outputFilename}`
  let status

  try {
    // create new output file
    console.log(`spooling changes for ${meta.db} since ${shortenSince(meta.since)}`)
    const ws = createWriteStream(tempOutputFile)

    // spool changes
    status = await changesreader(opts.url, opts.database, opts.since, ws, opts.deletions)

    // close the write stream
    ws.end()
  } catch (e) {
    console.error('Failed to spool changes from CouchDB')
    console.error(e.toString())
    // remove temp file
    unlinkSync(tempOutputFile)
    process.exit(2)
  }

  // copy tmp file to actual output file
  renameSync(tempOutputFile, outputFilename)
  console.log(outputFilename)

  // write new meta data
  meta.endTime = new Date().toISOString()
  Object.assign(meta, status)
  await saveMeta(meta)
  console.log(calculateMetaFilename(opts.database))

  // die
  process.exit(0)
}

