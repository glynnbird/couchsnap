#!/usr/bin/env node

// command-line args
const url = process.env.COUCH_URL || 'http://localhost:5984'
const db = process.env.COUCH_DATABASE
const args = require('yargs')
  .option('url', { alias: 'u', describe: 'CouchDB URL', default: url })
  .option('database', { alias: ['db', 'd'], describe: 'CouchDB database name', demandOption: !db, default: db })
  .option('deletions', { describe: 'Include deletions', type: 'boolean', demandOption: false, default: false })
  .help('help')
  .argv

// start the snapshot
const couchsnap = require('../index.js')
couchsnap.start(args)
  .then(console.log)
  .catch(console.error)
