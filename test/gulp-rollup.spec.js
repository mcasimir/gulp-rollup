'use strict';

var rollup       = require('..');
var File         = require('vinyl');
var Readable     = require('readable-stream').Readable;
var path         = require('path');
var string       = require('rollup-plugin-string');
var hypothetical = require('rollup-plugin-hypothetical');

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
  return executeAll(stream, { '': expected });
}

function executeAll(stream, expected) {
  return wrap(stream).then(function(files) {
    var keys = Object.keys(expected);

    if (keys.length === 1) {
      assertLength1(files);
    } else if (files.length !== keys.length) {
      throw new Error('Expected ' + keys.length + ' files, not ' + files.length + '!');
    }

    var done = [];

    for (var i = 0; i < files.length; ++i) {
      var expectedItem;
      if (keys.length === 1 && keys[0] === '') {
        expectedItem = expected[''];
      } else {
        expectedItem = expected[files[i].path];
        if (!expectedItem) {
          throw new Error('Unexpected file path ' + files[i].path + '!');
        }
        if (done.indexOf(files[i].path) !== -1) {
          throw new Error('Duplicate file path ' + files[i].path + '!');
        }
        done.push(files[i].path);
      }

      var object = {};
      (new Function('object', files[i].contents.toString()))(object);

      for (var key in expectedItem) {
        if (!(key in object)) {
          throw new Error('Expected object to have key "' + key + '"!');
        }
        var ok = JSON.stringify(object[key]), ek = JSON.stringify(expectedItem[key]);
        if (ok !== ek)  {
          throw new Error('Expected object.' + key + ' to be ' + ek + ', not ' + ok + '!');
        }
      }

      for (key in object) {
        if (!(key in expectedItem)) {
          throw new Error('Didn\'t expect object to have key "' + key + '"!');
        }
      }
    }
  });
}

function resolve(p) {
  return path.resolve(__dirname, p);
}

describe('gulp-rollup', function() {
  describe('Errors', function() {
    it('should be thrown when passed no options', function(done) {
      var stream = rollup();

      expectError(/options\.entry/, stream).then(done, done.fail);

      stream.end();
    });

    it('should be thrown when passed no options.entry', function(done) {
      var stream = rollup({});

      expectError(/options\.entry/, stream).then(done, done.fail);

      stream.end();
    });

    it('should be thrown when passed no files', function(done) {
      var stream = rollup({ entry: '/x' });

      expectError(/does not exist/, stream).then(done, done.fail);

      stream.end();
    });

    it('should be thrown when the entry does not exist', function(done) {
      var stream = rollup({ entry: '/x' });

      expectError(/does not exist/, stream).then(done, done.fail);

      stream.write(new File({
        path: '/not-x',
        contents: new Buffer('')
      }));
      stream.end();
    });

    it('should be thrown when given null files', function(done) {
      var stream = rollup({ entry: '/x' });

      expectError(/buffer/i, stream).then(done, done.fail);

      stream.write(new File({
        path: '/x'
      }));
      stream.end();
    });

    it('should be thrown when given streamed files', function(done) {
      var stream = rollup({ entry: '/x' });

      expectError(/buffer/i, stream).then(done, done.fail);

      stream.write(new File({
        path: '/x',
        contents: new Readable()
      }));
      stream.end();
    });

    it('should be thrown when given mixed mapped and non-mapped files', function(done) {
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

  it('should simulate an entry file', function(done) {
    var stream = rollup({ entry: '/x' });

    execute(stream, { key: 5 }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('object.key = 5')
    }));
    stream.end();
  });

  it('should simulate imported files', function(done) {
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

  it('should handle out-of-order files', function(done) {
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

  it('should reuse the entry file object for output', function(done) {
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

  it('should not add a sourcemap if the input lacks them', function(done) {
    var stream = rollup({ entry: '/x' });

    wrap(stream).then(function(files) {
      assertLength1(files);
      if (files[0].sourceMap !== undefined) {
        throw new Error('Output has a sourcemap attachment!');
      }
    }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('object.key = 5')
    }));
    stream.end();
  });

  it('should replace the sourcemap if the input has them', function(done) {
    var stream = rollup({ entry: '/x' });

    var x = new File({
      path: '/x',
      contents: new Buffer('import "./y"; object.key = 5')
    });
    var map = x.sourceMap = { mappings: '' };
    var y = new File({
      path: '/y',
      contents: new Buffer('object.key2 = 6')
    });
    y.sourceMap = { mappings: '' };

    wrap(stream).then(function(files) {
      assertLength1(files);
      if (files[0].sourceMap === undefined) {
        throw new Error('Output has no sourcemap attachment!');
      }
      if (files[0].sourceMap === map) {
        throw new Error('The original sourcemap was left in place!');
      }
    }).then(done, done.fail);

    stream.write(y);
    stream.write(x);
    stream.end();
  });

  it('shouldn\'t break with a custom Rollup', function(done) {
    var stream = rollup({ rollup: require('rollup'), entry: '/x' });

    execute(stream, { key: 5 }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('object.key = 5')
    }));
    stream.end();
  });

  it('should use a custom Rollup', function(done) {
    var stream = rollup({
      rollup: {
        rollup: function(options) {
          if (options.entry !== 'en-tree?') {
            throw new Error('Correct options were not passed to rollup()!');
          }
          return Promise.resolve({
            generate: function(options) {
              if (options.entry !== 'en-tree?') {
                throw new Error('Correct options were not passed to generate()!');
              }
              return { code: 'ephemeral style' };
            }
          });
        }
      },
      entry: 'en-tree?'
    });

    wrap(stream).then(function(files) {
      assertLength1(files);
      if (files[0].contents.toString() !== 'ephemeral style') {
        throw new Error('Output expected from custom Rollup was not received!');
      }
    }).then(done, done.fail);

    stream.end();
  });

  it('should forbid real files by default', function(done) {
    var stream = rollup({ entry: resolve('x') });

    expectError(/does not exist/, stream).then(done, done.fail);

    stream.write(new File({
      path: resolve('x'),
      contents: new Buffer('import "./fixures/a.js"; object.key = 5')
    }));
    stream.end();
  });

  it('should allow real files when options.allowRealFiles is true', function(done) {
    var stream = rollup({ entry: resolve('x'), allowRealFiles: true });

    execute(stream, { key: 5, key4: 'value' }).then(done, done.fail);

    stream.write(new File({
      path: resolve('x'),
      contents: new Buffer('import "./fixtures/a.js"; object.key = 5')
    }));
    stream.end();
  });

  it('should allow a real file as the entry when options.allowRealFiles is true', function(done) {
    var stream = rollup({ entry: resolve('./fixtures/b.js'), allowRealFiles: true });

    execute(stream, { key: 5, key5: 'eulav' }).then(done, done.fail);

    stream.write(new File({
      path: resolve('x'),
      contents: new Buffer('object.key = 5')
    }));
    stream.end();
  });

  it('shouldn\'t interfere with transformer plugins', function(done) {
    var stream = rollup({
      entry: '/x',
      plugins: string({ include: '/y' })
    });

    execute(stream, { key: 'hey' }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('import hey from "./y"; object.key = hey')
    }));
    stream.write(new File({
      path: '/y',
      contents: new Buffer('hey')
    }));
    stream.end();
  });

  it('shouldn\'t interfere with resolver/loader plugins', function(done) {
    var stream = rollup({
      entry: '/x',
      plugins: hypothetical({
        files: {
          'where shall we have lunch?': 'object.key6 = "Milliways"'
        },
        allowRealFiles: true,
        leaveIdsAlone: true
      })
    });

    execute(stream, { key: 5, key6: 'Milliways' }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('import "where shall we have lunch?"; object.key = 5')
    }));
    stream.end();
  });

  it('should accept multiple entries', function(done) {
    var stream = rollup({ entry: ['/x', '/y'] });

    executeAll(stream, {
      '/x': { key: 5 },
      '/y': { key2: 6 }
    }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('object.key = 5')
    }));
    stream.write(new File({
      path: '/y',
      contents: new Buffer('object.key2 = 6')
    }));
    stream.end();
  });

  it('should roll up multiple entries', function(done) {
    var stream = rollup({ entry: ['/z', '/x'] });

    executeAll(stream, {
      '/x': { key2: 6, key3: 7, key: 5 },
      '/z': { key2: 6, key3: 7 }
    }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('import "./y"; import "./z"; object.key = 5')
    }));
    stream.write(new File({
      path: '/y',
      contents: new Buffer('object.key2 = 6')
    }));
    stream.write(new File({
      path: '/z',
      contents: new Buffer('import "./y"; object.key3 = 7')
    }));
    stream.end();
  });

  it('should accept a Promise as an entry', function(done) {
    var stream = rollup({ entry: Promise.resolve('/x') });

    execute(stream, { key: 5 }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('object.key = 5')
    }));
    stream.end();
  });

  it('should accept multiple entries', function(done) {
    var stream = rollup({ entry: Promise.resolve(['/x', '/y']) });

    executeAll(stream, {
      '/x': { key: 5 },
      '/y': { key2: 6 }
    }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('object.key = 5')
    }));
    stream.write(new File({
      path: '/y',
      contents: new Buffer('object.key2 = 6')
    }));
    stream.end();
  });

  it('should accept a Promise that takes a while to resolve as an entry', function(done) {
    var stream = rollup({
      entry: new Promise(function(resolve) {
        setTimeout(function() {
          resolve('/x');
        }, 500);
      })
    });

    execute(stream, { key: 5 }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('object.key = 5')
    }));
    stream.end();
  });

  it('should pass on errors from the entry Promise', function(done) {
    var stream = rollup({ entry: Promise.reject(new Error('oh NOOOOOO')) });

    expectError(/oh NOOOOOO/, stream).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: new Buffer('object.key = 5')
    }));
    stream.end();
  });
});
