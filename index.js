const changesreader = require('./changesreader.js')
const fs = require('fs')
const URL = require('url').URL

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

// save the latest meta data JSON
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
  const outputFilename = `${meta.db}-snapshot-${meta.startTime}.jsonl`
  const tempOutputFile = `_tmp_${outputFilename}`
  let status

  try {
    // create new output file
    console.log(`spooling changes for ${meta.db} since ${shortenSince(meta.since)}`)
    const ws = fs.createWriteStream(tempOutputFile)

    // spool changes
    status = await changesreader(opts.url, opts.database, opts.since, ws)
    console.log('Finished fetching changes')

    // close the write stream
    ws.end()
  } catch (e) {
    console.error('Failed to spool changes from CouchDB')
    console.error(e.toString())
    // remove temp file
    fs.unlinkSync(tempOutputFile)
    process.exit(2)
  }

  // copy tmp file to actual output file
  fs.renameSync(tempOutputFile, outputFilename)
  console.log(`to new output file ${outputFilename}`)

  // write new meta data
  meta.endTime = new Date().toISOString()
  Object.assign(meta, status)
  await saveMeta(meta)
  console.log('Written meta data file')

  // die
  process.exit(0)
}

module.exports = {
  start
}
