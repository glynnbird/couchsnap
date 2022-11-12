const stream = require('stream')

// returns a stream transformer
module.exports = function () {

  // create stream transformer
  const filter = new stream.Transform({ objectMode: true })

  // add _transform function
  filter._transform = function (obj, encoding, done) {
    // ignore deleted docs
    if (obj._deleted) {
      return done()
    }
    
    // scrub the rev token
    delete obj._rev

    // turn object into a string
    this.push(JSON.stringify(obj)+'\n')
    done()
  }

  return filter
}