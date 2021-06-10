# couchsnap

Super-simple CouchDB snapshotting tool

## Installation

Install on your machine (Node.js & npm required):

```sh
$ npm install -g couchsnap
```

## Reference

Environment variables:

- `COUCH_URL` - the URL of your CouchDB service e.g. `http://user:pass@myhost.com`
- `COUCH_DATABASE` - the name of the database to work with e.g. `orders`

## Usage

To spool the winning revisions of every document to stdout:

```sh
# to stdout
couchsnap --db mydb

# to a file
couchsnap --db mydb > mydb.txt
```

> Note that if a document changes during the snapshotting process, it may appear more than once in the output.

## Output format

- one document per line
- last line contains meta data

```js
{"lastSeq":"23578-g1AAAA","numChanges":23537,"db":"mydb","timestamp":"2021-06-10T12:29:15.196Z","hostname":"myhost.cloudant.com"}
```