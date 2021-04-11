'use strict';

var rollup       = require('..');
var File         = require('vinyl');
var Readable     = require('readable-stream').Readable;
var path         = require('path');
var string       = require('rollup-plugin-string');
var hypothetical = require('rollup-plugin-hypothetical');
const bufferFrom = require('buffer-from');

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

      expectError(/options\.input/, stream).then(done, done.fail);

      stream.end();
    });

    it('should be thrown when passed no options.input', function(done) {
      var stream = rollup({});

      expectError(/options\.input/, stream).then(done, done.fail);

      stream.end();
    });

    it('should be thrown when passed no files', function(done) {
      var stream = rollup({
        input: '/x',
        output: {
          format: 'es'
        }
      });

      expectError(/does not exist/, stream).then(done, done.fail);

      stream.end();
    });

    it('should be thrown when the input does not exist', function(done) {
      var stream = rollup({
        input: '/x',
        output: {
          format: 'es'
        }
      });

      expectError(/does not exist/, stream).then(done, done.fail);

      stream.write(new File({
        path: '/not-x',
        contents: bufferFrom('')
      }));
      stream.end();
    });

    it('should be thrown when given null files', function(done) {
      var stream = rollup({
        input: '/x',
        output: {
          format: 'es'
        }
      });

      expectError(/buffer/i, stream).then(done, done.fail);

      stream.write(new File({
        path: '/x'
      }));
      stream.end();
    });

    it('should be thrown when given streamed files', function(done) {
      var stream = rollup({
        input: '/x',
        output: {
          format: 'es'
        }
      });

      expectError(/Input files must be buffered!/i, stream).then(done, done.fail);

      stream.write(new File({
        path: '/x',
        contents: new Readable()
      }));
      stream.end();
    });

    it('should be thrown when given mixed mapped and non-mapped files', function(done) {
      var stream = rollup({
        input: '/x',
        output: {
          format: 'es'
        }
      });

      expectError(/sourcemap/i, stream).then(done, done.fail);

      var mapped = new File({
        path: '/x',
        contents: bufferFrom('')
      });
      mapped.sourceMap = {};
      stream.write(mapped);
      stream.write(new File({
        path: '/y',
        contents: bufferFrom('')
      }));
      stream.end();
    });
  });

  it('should simulate an input file', function(done) {
    var stream = rollup({
      input: '/x',
      output: {
        format: 'es'
      }
    });

    execute(stream, { key: 5 }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('object.key = 5')
    }));
    stream.end();
  });

  it('should simulate imported files', function(done) {
    var stream = rollup({
      input: '/x',
      output: {
        format: 'es'
      }
    });

    execute(stream, { key: 5, key2: 6, key3: 'a' }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('import "./y"; object.key = 5')
    }));
    stream.write(new File({
      path: '/y',
      contents: bufferFrom('import "./z"; object.key2 = 6')
    }));
    stream.write(new File({
      path: '/z',
      contents: bufferFrom('object.key3 = "a"')
    }));
    stream.end();
  });

  it('should handle out-of-order files', function(done) {
    var stream = rollup({
      input: '/x',
      output: {
        format: 'es'
      }
    });

    execute(stream, { key: 5, key2: 6, key3: 'a' }).then(done, done.fail);

    stream.write(new File({
      path: '/z',
      contents: bufferFrom('object.key3 = "a"')
    }));
    stream.write(new File({
      path: '/y',
      contents: bufferFrom('import "./z"; object.key2 = 6')
    }));
    stream.write(new File({
      path: '/x',
      contents: bufferFrom('import "./y"; object.key = 5')
    }));
    stream.end();
  });

  it('should reuse the input file object for output', function(done) {
    var stream = rollup({
      input: '/x',
      output: {
        format: 'es'
      }
    });

    var input = new File({
      path: '/x',
      contents: bufferFrom('import "./y"; object.key = 5')
    });

    wrap(stream).then(function(files) {
      assertLength1(files);
      if (files[0] !== input) {
        throw new Error('Output is not input file object!');
      }
    }).then(done, done.fail);

    stream.write(new File({
      path: '/z',
      contents: bufferFrom('object.key3 = "a"')
    }));
    stream.write(input);
    stream.write(new File({
      path: '/y',
      contents: bufferFrom('import "./z"; object.key2 = 6')
    }));
    stream.end();
  });

  it('should not add a sourcemap if the input lacks them', function(done) {
    var stream = rollup({
      input: '/x',
      output: {
        format: 'es'
      }
    });

    wrap(stream).then(function(files) {
      assertLength1(files);
      if (files[0].sourceMap !== undefined) {
        throw new Error('Output has a sourcemap attachment!');
      }
    }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('object.key = 5')
    }));
    stream.end();
  });

  it('should replace the sourcemap if the input has them', function(done) {
    var stream = rollup({
      input: '/x',
      output: {
        format: 'es'
      }
    });

    var x = new File({
      path: '/x',
      contents: bufferFrom('import "./y"; object.key = 5')
    });
    var map = x.sourceMap = { mappings: '' };
    var y = new File({
      path: '/y',
      contents: bufferFrom('object.key2 = 6')
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
    var stream = rollup({
      rollup: require('rollup'),
      input: '/x',
      output: {
        format: 'es'
      }
    });

    execute(stream, { key: 5 }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('object.key = 5')
    }));
    stream.end();
  });

  it('should use a custom Rollup', function(done) {
    var stream = rollup({
      rollup: {
        rollup: function(options) {
          if (options.input !== 'en-tree?') {
            throw new Error('Correct options were not passed to rollup()!');
          }
          return Promise.resolve({
            generate: function(options) {
              if (options.input !== 'en-tree?') {
                throw new Error('Correct options were not passed to generate()!');
              }
              return Promise.resolve({ output: [{ code: 'ephemeral style' }] });
            }
          });
        }
      },
      input: 'en-tree?'
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
    var stream = rollup({
      input: resolve('x'),
      output: {
        format: 'es'
      }
    });

    expectError(/does not exist/, stream).then(done, done.fail);

    stream.write(new File({
      path: resolve('x'),
      contents: bufferFrom('import "./fixures/a.js"; object.key = 5')
    }));
    stream.end();
  });

  it('should allow real files when options.allowRealFiles is true', function(done) {
    var stream = rollup({
      input: resolve('x'),
      output: {
        format: 'es'
      },
      allowRealFiles: true
    });

    execute(stream, { key: 5, key4: 'value' }).then(done, done.fail);

    stream.write(new File({
      path: resolve('x'),
      contents: bufferFrom('import "./fixtures/a.js"; object.key = 5')
    }));
    stream.end();
  });

  it('should allow a real file as the input when options.allowRealFiles is true', function(done) {
    var stream = rollup({
      input: resolve('./fixtures/b.js'),
      output: {
        format: 'es'
      },
      allowRealFiles: true
    });

    execute(stream, { key: 5, key5: 'eulav' }).then(done, done.fail);

    stream.write(new File({
      path: resolve('x'),
      contents: bufferFrom('object.key = 5')
    }));
    stream.end();
  });

  it('shouldn\'t interfere with transformer plugins', function(done) {
    var stream = rollup({
      input: '/x',
      output: {
        format: 'es',
      },
      plugins: string({ include: '/y' })
    });

    execute(stream, { key: 'hey' }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('import hey from "./y"; object.key = hey')
    }));
    stream.write(new File({
      path: '/y',
      contents: bufferFrom('hey')
    }));
    stream.end();
  });

  it('shouldn\'t interfere with resolver/loader plugins', function(done) {
    var stream = rollup({
      input: '/x',
      output: {
        format: 'es',
      },
      plugins: hypothetical({
        files: {
          'where shall we have lunch?': 'object.key6 = "Milliways"'
        },
        allowFallthrough: true,
        leaveIdsAlone: true
      })
    });

    execute(stream, { key: 5, key6: 'Milliways' }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('import "where shall we have lunch?"; object.key = 5')
    }));
    stream.end();
  });

  it('should accept multiple entries', function(done) {
    var stream = rollup({
      input: ['/x', '/y'],
      output: {
        format: 'es'
      }
    });

    executeAll(stream, {
      '/x': { key: 5 },
      '/y': { key2: 6 }
    }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('object.key = 5')
    }));
    stream.write(new File({
      path: '/y',
      contents: bufferFrom('object.key2 = 6')
    }));
    stream.end();
  });

  it('should roll up multiple entries', function(done) {
    var stream = rollup({
      input: ['/z', '/x'],
      output: {
        format: 'es'
      }
    });

    executeAll(stream, {
      '/x': { key2: 6, key3: 7, key: 5 },
      '/z': { key2: 6, key3: 7 }
    }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('import "./y"; import "./z"; object.key = 5')
    }));
    stream.write(new File({
      path: '/y',
      contents: bufferFrom('object.key2 = 6')
    }));
    stream.write(new File({
      path: '/z',
      contents: bufferFrom('import "./y"; object.key3 = 7')
    }));
    stream.end();
  });

  it('should accept a Promise as an input', function(done) {
    var stream = rollup({
      input: Promise.resolve('/x'),
      output: {
        format: 'es'
      }
    });

    execute(stream, { key: 5 }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('object.key = 5')
    }));
    stream.end();
  });

  it('should accept multiple entries', function(done) {
    var stream = rollup({
      input: Promise.resolve(['/x', '/y']),
      output: {
        format: 'es'
      }
    });

    executeAll(stream, {
      '/x': { key: 5 },
      '/y': { key2: 6 }
    }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('object.key = 5')
    }));
    stream.write(new File({
      path: '/y',
      contents: bufferFrom('object.key2 = 6')
    }));
    stream.end();
  });

  it('should accept a Promise that takes a while to resolve as an input', function(done) {
    var stream = rollup({
      input: new Promise(function(resolve) {
        setTimeout(function() {
          resolve('/x');
        }, 500);
      }),
      output: {
        format: 'es'
      }
    });

    execute(stream, { key: 5 }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('object.key = 5')
    }));
    stream.end();
  });

  it('should pass on errors from the input Promise', function(done) {
    var stream = rollup({
      input: Promise.reject(new Error('oh NOOOOOO')),
      output: {
        format: 'es'
      }
    });

    expectError(/oh NOOOOOO/, stream).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('object.key = 5')
    }));
    stream.end();
  });

  it('should add a .js extension if necessary by default', function(done) {
    var stream = rollup({
      input: '/x',
      output: {
        format: 'es'
      }
    });

    execute(stream, { key: 5 }).then(done, done.fail);

    stream.write(new File({
      path: '/x.js',
      contents: bufferFrom('object.key = 5')
    }));
    stream.end();
  });

  it('should add extensions in options.impliedExtensions if necessary', function(done) {
    var stream = rollup({
      input: '/x',
      output: {
        format: 'es',
      },
      impliedExtensions: ['.lol', '.ha']
    });

    execute(stream, { key: 5, key2: true }).then(done, done.fail);

    stream.write(new File({
      path: '/x.lol',
      contents: bufferFrom('import \'./y\'; object.key = 5')
    }));
    stream.write(new File({
      path: '/y.ha',
      contents: bufferFrom('object.key2 = true')
    }));
    stream.end();
  });

  it('shouldn\'t add any extensions if options.impliedExtensions is false', function(done) {
    var stream = rollup({
      input: '/x',
      output: {
        format: 'es',
      },
      impliedExtensions: false
    });

    expectError(/does not exist in the hypothetical file system/, stream).then(done, done.fail);

    stream.write(new File({
      path: '/x.js',
      contents: bufferFrom('object.key = 5')
    }));
    stream.end();
  });

  it('should emit a "bundle" event for each input point', function(done) {
    var entries = ['/x', '/y', '/z'];

    var stream = rollup({
      input: entries,
      output: {
        format: 'es'
      }
    });

    var received = {};
    stream.on('bundle', function(bundle, name) {
      received[name] = bundle;
    });

    wrap(stream).then(function(files) {
      if (files.length !== 3) {
        throw new Error('Expected 3 files, not ' + files.length + '!');
      }
      var missing = [], nonObject = [], malformed = [];
      for (var i = 0; i < entries.length; ++i) {
        var name = entries[i], bundle = received[name];
        if (!Object.prototype.hasOwnProperty.call(received, name)) {
          missing.push(name);
        } else if (typeof bundle !== 'object' || bundle === null) {
          nonObject.push(name);
        } else if (!Array.isArray(bundle.cache.modules)) {
          malformed.push(name);
        }
      }
      if (missing.length > 0) {
        throw new Error('Entry points with missing bundles: ' + missing);
      } else if (nonObject.length > 0) {
        throw new Error('Entry points with non-object bundles: ' + nonObject);
      } else if (malformed.length > 0) {
        throw new Error('Entry points with missing bundle.modules: ' + malformed);
      }
    }).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('import \'./y\'; object.key = 5;')
    }));
    stream.write(new File({
      path: '/y',
      contents: bufferFrom('import \'./z\'; object.key2 = true;')
    }));
    stream.write(new File({
      path: '/z',
      contents: bufferFrom('object.key3 = {};')
    }));
    stream.end();
  });

  it('should provide appropriate caches when options.separateCaches is given', function(done) {
    var caches = {
      '/x': {},
      '/y': {},
      '/z': {}
    };

    var stream = rollup({
      input: ['/x', '/y', '/z'],
      separateCaches: {
        '/x': caches['/x'],
        '/y': caches['/y']
      },
      cache: caches['/z'],
      output: {
        format: 'es',
      },
      rollup: {
        rollup: function(options) {
          if (options.cache !== caches[options.input]) {
            throw new Error('Got incorrect cache for ' + options.input + ' in rollup()!');
          }

          return Promise.resolve({
            generate: function(options) {
              if (options.cache !== caches[options.input]) {
                throw new Error('Got incorrect cache for ' + options.input + ' in generate()!');
              }

              return Promise.resolve({ output: [{ code: 'yay.' }] });
            }
          });
        }
      }
    });

    wrap(stream).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('x')
    }));
    stream.write(new File({
      path: '/y',
      contents: bufferFrom('y')
    }));
    stream.write(new File({
      path: '/z',
      contents: bufferFrom('z')
    }));
    stream.end();
  });

  it('should generate a usable unified cache if generateUnifiedCache is given', function(done) {
    var cache;

    var x = new File({
      path: '/x',
      contents: bufferFrom('import "y"; import "z"; object.key = 7;')
    });
    var y = new File({
      path: '/y',
      contents: bufferFrom('import "z"; import "w"; object.key2 = 0;')
    });
    var z = new File({
      path: '/z',
      contents: bufferFrom('object.key3 = 1;')
    });
    var w = new File({
      path: '/w',
      contents: bufferFrom('object.key4 = 3;')
    });

    var stream = rollup({
      input: ['/x', '/y'],
      generateUnifiedCache: true,
      plugins: {
        resolveId: function(id) {
          if (id.charAt(0) !== '/') {
            id = '/' + id;
          }
          return '/' + id;
        },
        transform: function(source) {
          return source.replace('key', 'kay');
        }
      },
      output: {
        format: 'es'
      }
    });

    stream.on('unifiedcache', function(unifiedCache) {
      cache = unifiedCache;
    });

    wrap(stream).then(function(files1) {
      var stream = rollup({
        input: ['/x', '/y'],
        cache: cache,
        plugins: {
          resolveId: function(id) {
            return id;
          },
          transform: function(source) {
            return source;
          }
        },
        output: {
          format: 'es'
        }
      });

      var promise = wrap(stream).then(function(files2) {
        function isTheRightFile(file) {
          return file.path === file1.path;
        }
        for (var i = 0; i < files1.length; ++i) {
          var file1 = files1[i], file2 = files2.filter(isTheRightFile)[0];
          if (file1.contents.toString() !== file2.contents.toString()) {
            throw new Error('Differing outputs for ' + file1.path + '!');
          }
        }
      });

      stream.write(x);
      stream.write(y);
      stream.write(z);
      stream.write(w);
      stream.end();

      return promise;
    }).then(done, done.fail);

    stream.write(x);
    stream.write(y);
    stream.write(z);
    stream.write(w);
    stream.end();
  });

  it('should reject if cache outputs disagree on file contents', function(done) {
    var callCount = 0;
    var stream = rollup({
      input: ['/x', '/y'],
      generateUnifiedCache: true,
      plugins: {
        transform: function(source) {
          return source.replace('key', 'k' + (callCount++) + 'y');
        }
      },
      output: {
        format: 'es'
      }
    });

    expectError(/conflicting caches/i, stream).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('import "./z"; object.key = 7;')
    }));
    stream.write(new File({
      path: '/y',
      contents: bufferFrom('import "./z"; object.key2 = 0;')
    }));
    stream.write(new File({
      path: '/z',
      contents: bufferFrom('object.key3 = 1;')
    }));
    stream.end();
  });

  it('should reject if cache outputs disagree on resolved IDs', function(done) {
    var callCount = 0;
    var stream = rollup({
      input: ['/x', '/y'],
      generateUnifiedCache: true,
      plugins: {
        resolveId: function(id) {
          if (id === '/w') {
            return id + (callCount++);
          } else {
            return id;
          }
        }
      },
      output: {
        format: 'es'
      }
    });

    expectError(/conflicting caches/i, stream).then(done, done.fail);

    stream.write(new File({
      path: '/x',
      contents: bufferFrom('import "/z"; object.key = 7;')
    }));
    stream.write(new File({
      path: '/y',
      contents: bufferFrom('import "/z"; object.key2 = 0;')
    }));
    stream.write(new File({
      path: '/z',
      contents: bufferFrom('import "/w"; object.key3 = 1;')
    }));
    stream.write(new File({
      path: '/w0',
      contents: bufferFrom('object.key4 = 3;')
    }));
    stream.write(new File({
      path: '/w1',
      contents: bufferFrom('object.key4 = 3;')
    }));
    stream.end();
  });
});
