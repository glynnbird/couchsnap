# couchsnap

Super-simple CouchDB snapshotting tool for creating incremental snapshots of the winning revisions of documents in a Apache CouchDB or Cloudant database.

- winning revisions only of documents and design documents
- no deletions  (unless `--deletions true` is supplied).
- no attachments
- no conflicts

## Installation

Install on your machine (Node.js & npm required):

```sh
$ npm install -g couchsnap
```

## Reference

Environment variables:

- `COUCH_URL` - the URL of your CouchDB service e.g. `http://user:pass@myhost.com`
- `COUCH_DATABASE` - (optional) the name of the database to work with e.g. `orders`
- `IAM_API_KEY` - (optional) if using IBM IAM for authentication

## Usage

- `--url/-u` - same as `COUCH_URL` environment variable.
- `--database/-db/-d` - same as `COUCH_DATABASE environment variable.
- `--deletions` - include deleted documents in the output. (Default: `false`).

Put your CouchDB URL (with credentials) in an environment variable:

```sh
$ export COUCH_URL="https://username:password@mycouchdb.myhost.com"
```

Create a snapshot:

```sh
$ couchsnap --db mydb
spooling changes for mydb since 0
Finished fetching changes
mydb-snapshot-2022-11-09T160406.195Z.jsonl
mydb-meta.json
```

At a later date, another snapshot can be taken:

```sh
$ couchsnap --db mydb
spooling changes for mydb since 23597-*****
mydb-snapshot-2022-11-09T160451.041Z.jsonl
mydb-meta.json
```

Ad infinitum.

You may elect to include deleted documents by adding `--deletions` e.g.

```sh
$ couchsnap --db mydb --deletions
...
```

## Finding a document's history

For a known document id e.g. `abc123`:

```sh
grep -h "abc123" mydb-snapshot-*
```

## Restoring a database

Each backup file contains one document per line so we can feed this data to [couchimport](https://www.npmjs.com/package/couchimport) using its 'jsonl' mode. To ensure that we insert the newest data first, we can concatenate the snapshots in newest-first order:

```sh
# list the files in reverse time order, "cat" them and send them to couchimport
ls -t mydb-snapshot-* | xargs cat | couchimport --db mydb2 --type jsonl
# or use "tac" to reverse the order of each file
ls -t mydb-snapshot-* | xargs tac | couchimport --db mydb2 --type jsonl
```

Some caveats:

1. This only restores to a new empty database.
2. Deleted documents are neither backed-up nor restored (unless `--deletions` is supplied).
3. The restored documents will have a new `_rev` token. e.g. `1-abc123`. i.e. the restored database would be unsuitable for a replicating relationship with the original database (as they have different revision histories).
4. Attachments are neither backud-up or restored.
5. Conflicting document revisions are neither backed-up nor restored.
6. Secondary index definitions (in design documents) are backed up but will need to be rebuilt on restore.

## Programmatic usage

```js
import { couchsnap } from 'couchsnap'

const opts = {
  url: 'https://username:password@mycouchdb.com',
  database: 'cities'
}
await couchsnap(opts)
```

## How does it work?

`couchsnap` simply spools the changes feed storing the winning revisions of each non-deleted document to a file - one row line per document. The documents are stored without their revision tokens (`_rev`) to avoid creating conflicts on restore.

When snapshotting a database, two files are created:

```
<database>-snapshot-<timestamp>.jsonl
<database>-meta.json
```

The meta file contains meta data about where the last snapshot left off, so that a new snapshot can resume from the location.

> Note: The nature of the CouchDB changes feed means that some snapshots may contain duplicate changes as the changes feed only guarantees "at least once" delivery.
