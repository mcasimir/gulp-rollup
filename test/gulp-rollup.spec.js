'use strict';

var rollup      = require('..');
var File        = require('vinyl');
var Readable    = require('readable-stream');

function assertLength1(files) {
  if (files.length !== 1) {
    throw new Error('Expected 1 file, not ' + files.length + '!');
  }
}

function expectError(including, stream) {
  if (stream == null) {
    stream = including;
    including = null;
  }
  return new Promise(function(resolve, reject) {
    var errored = false;
    stream.on('error', function(err) {
      errored = true;
      if (including == null || including.test(err.message)) {
        resolve();
      } else {
        reject(new Error('"' + err.message + '" does not match ' + including + '!'));
      }
    });
    stream.on('end', function() {
      if (!errored) {
        reject(new Error('Stream ended instead of erroring!'));
      }
    });
  });
}

function wrap(stream) {
  return new Promise(function(resolve, reject) {
    var data = [];
    stream.on('end', function() {
      resolve(data);
    });
    stream.on('error', reject);
    stream.on('data', function(chunk) {
      data.push(chunk);
    });
  });
}

function execute(stream, expected) {
  return wrap(stream).then(function(files) {
    assertLength1(files);
    var object = {};
    (new Function('object', files[0].contents.toString()))(object);
    for (var key in expected) {
      if (!(key in object)) {
        throw new Error('Expected object to have key "' + key + '"!');
      }
      var ok = JSON.stringify(object[key]), ek = JSON.stringify(expected[key]);
      if (ok !== ek)  {
        throw new Error('Expected object.' + key + ' to be ' + ek + ', not ' + ok + '!');
      }
    }
    for (key in object) {
      if (!(key in expected)) {
        throw new Error('Didn\'t expect object to have key "'+key+'"!');
      }
    }
  });
}

describe('gulp-rollup', function() {
  describe('Errors', function() {
    it('Should error when passed no options', function(done) {
      var stream = rollup();

      expectError(/options\.entry/, stream).then(done, done.fail);

      stream.end();
    });

    it('Should error when passed no options.entry', function(done) {
      var stream = rollup({});

      expectError(/options\.entry/, stream).then(done, done.fail);

      stream.end();
    });

    it('Should error when passed no files', function(done) {
      var stream = rollup({ entry: '/x' });

      expectError(/does not exist/, stream).then(done, done.fail);

      stream.end();
    });

    it('Should error when the entry does not exist', function(done) {
      var stream = rollup({ entry: '/x' });

      expectError(/does not exist/, stream).then(done, done.fail);

      stream.write(new File({
        path: '/not-x',
        contents: new Buffer('')
      }));
      stream.end();
    });

    it('Should error when given null files', function(done) {
      var stream = rollup({ entry: '/x' });

      expectError(/buffer/i, stream).then(done, done.fail);

      stream.write(new File({
        path: '/x'
      }));
      stream.end();
    });

    it('Should error when given streamed files', function(done) {
      var stream = rollup({ entry: '/x' });

      expectError(/buffer/i, stream).then(done, done.fail);

      stream.write(new File({
        path: '/x',
        contents: new Readable()
      }));
      stream.end();
    });

    it('Should error when given mixed mapped and non-mapped files', function(done) {
      var stream = rollup({ entry: '/x' });

      expectError(/sourcemap/i, stream).then(done, done.fail);

      var mapped = new File({
        path: '/x',
        contents: new Buffer('')
      });
      mapped.sourceMap = {};
      stream.write(mapped);
      stream.write(new File({
        path: '/y',
        contents: new Buffer('')
      }));
      stream.end();
    });
  });

  it('Should simulate the entry file', function(done) {
    var stream = rollup({ entry: '/x' });

    execute(stream, { key: 5 }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('object.key = 5')
    }));
    stream.end();
  });

  it('Should simulate imported files', function(done) {
    var stream = rollup({ entry: '/x' });

    execute(stream, { key: 5, key2: 6, key3: 'a' }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('import "./y"; object.key = 5')
    }));
    stream.write(new File({
      path: '/y',
      contents: new Buffer('import "./z"; object.key2 = 6')
    }));
    stream.write(new File({
      path: '/z',
      contents: new Buffer('object.key3 = "a"')
    }));
    stream.end();
  });

  it('Should handle out-of-order files', function(done) {
    var stream = rollup({ entry: '/x' });

    execute(stream, { key: 5, key2: 6, key3: 'a' }).then(done, done.fail);

    stream.write(new File({
      path: '/z',
      contents: new Buffer('object.key3 = "a"')
    }));
    stream.write(new File({
      path: '/y',
      contents: new Buffer('import "./z"; object.key2 = 6')
    }));
    stream.write(new File({
      path: '/x',
      contents: new Buffer('import "./y"; object.key = 5')
    }));
    stream.end();
  });

  it('Should reuse the entry file object for output', function(done) {
    var stream = rollup({ entry: '/x' });

    var entry = new File({
      path: '/x',
      contents: new Buffer('import "./y"; object.key = 5')
    });

    wrap(stream).then(function(files) {
      assertLength1(files);
      if (files[0] !== entry) {
        throw new Error('Output is not entry file object!');
      }
    }).then(done, done.fail);

    stream.write(new File({
      path: '/z',
      contents: new Buffer('object.key3 = "a"')
    }));
    stream.write(entry);
    stream.write(new File({
      path: '/y',
      contents: new Buffer('import "./z"; object.key2 = 6')
    }));
    stream.end();
  });
});
