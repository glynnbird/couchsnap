#!/usr/bin/env node

// command-line args
const url = process.env.COUCH_URL || 'http://localhost:5984'
const db = process.env.COUCH_DATABASE
const args = require('yargs')
  .option('url', { alias: 'u', describe: 'CouchDB URL', default: url })
  .option('database', { alias: ['db', 'd'], describe: 'CouchDB database name', demandOption: !db, default: db })
  .options('since', { alias: 's', describe: 'Since/Sequence token', default: '0' })
  .help('help')
  .argv

// start the data warehouse
const couchsnap = require('../index.js')
couchsnap.start(args)
