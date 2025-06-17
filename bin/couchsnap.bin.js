#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { couchsnap } from '../index.js'

const syntax = 
`Syntax:
--url/-u           (COUCH_URL)      CouchDB URL          (required)
--database/--db/-d (COUCH_DATABASE) CouchDB Datbase name (required)
--deletions                         Include deleted docs (default: false)
--version/v                         Show app version     (default: false)
`
const url = process.env.COUCH_URL || 'http://localhost:5984'
const db = process.env.COUCH_DATABASE
const app = JSON.parse(readFileSync('./package.json', { encoding: 'utf8' }))
const argv = process.argv.slice(2)
const options = {
  url: {
    type: 'string',
    short: 'u',
    default: url
  },
  database: {
    type: 'string',
    short: 'd',
    default: db
  },
  db: {
    type: 'string',
    default: db
  },
  deletions: {
    type: 'boolean',
    default: false
  },
  version: {
    type: 'boolean',
    short: 'v',
    default: false
  },
  help: {
    type: 'boolean',
    short: 'h',
    default: false
  }
}

// parse command-line options
const { values } = parseArgs({ argv, options })
if (values.db) {
  values.database = values.db
  delete values.db
}
// version mode
if (values.version) {
  console.log(`${app.name} ${app.version}`)
  process.exit(0)
}

// help mode
if (values.help) {
  console.log(syntax)
  process.exit(0)
}

// must supply URL & database
if (!values.url || !values.database) {
  console.error(syntax, 'Error: You must supply a url and database name')
  process.exit(1)
}

// start the snapshot
couchsnap(values)
  .then(console.log)
  .catch(console.error)
