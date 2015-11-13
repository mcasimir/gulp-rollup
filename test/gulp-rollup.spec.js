'use strict';

var fs          = require('fs');
var gutil       = require('gulp-util');
var rollupLib   = require('rollup');
var es          = require('event-stream');
var rollup      = require('..');

var files = {
  'empty.js': fs.readFileSync(__dirname + '/fixtures/empty.js'),
  'fails.js': fs.readFileSync(__dirname + '/fixtures/fails.js'),
  'nonempty.js': fs.readFileSync(__dirname + '/fixtures/nonempty.js')
};

function fixture(path, base) {
  var opts = {
    path: __dirname + '/fixtures/' + path,
    contents: files[path] || null
  };
  if (!base) {
    opts.base = __dirname + '/fixtures/' + base;
  }
  return new gutil.File(opts);
}

describe('gulp-rollup', function() {
  it('Shouldn\'t throw with non existing entry file', function() {
    var stream = rollup();

    expect(function() {
      stream.write(fixture('notfound.js'));
    }).not.toThrow(/ENOENT/);

    stream.end();
  });

  it('Should pass source as entry to rollup', function(done) {
    spyOn(rollupLib, 'rollup').and.callThrough();
    var stream = rollup();

    stream.pipe(es.through(function(file) {
      expect(file.path).toEqual(fixture('empty.js').path);
      done();
    }));

    stream.write(fixture('empty.js'));
    stream.end();
  });

  it('Shouldn\'t override entry option', function(done) {
    spyOn(rollupLib, 'rollup').and.callThrough();
    var stream = rollup({entry: 'overridden.js'});

    stream.pipe(es.through(function(file) {
      expect(file.path).toEqual(fixture('empty.js').path);
      done();
    }));

    stream.write(fixture('empty.js'));
    stream.end();
  });

  it('Should pass options to rollup', function(done) {
    spyOn(rollupLib, 'rollup').and.callThrough();
    var options = {
      format: 'amd'
    };

    var stream = rollup(options);

    stream.pipe(es.through(function() {
      expect(rollupLib.rollup).toHaveBeenCalledWith(options);
      done();
    }));

    stream.write(fixture('empty.js'));
    stream.end();
  });

  it('Should invoke bundle.generate with options - 1', function(done) {
    var stream = rollup({
      format: 'iife'
    });

    stream.pipe(es.through(function(file) {
      expect(file.contents.toString().replace(/\n/g, '')).toBe('(function () { \'use strict\';})();');
      done();
    }));

    stream.write(fixture('empty.js'));
    stream.end();
  });

  it('Should invoke bundle.generate with options - 2', function(done) {
    var stream = rollup({
      format: 'amd'
    });

    stream.pipe(es.through(function(file) {
      expect(file.contents.toString().replace(/\n/g, '')).toBe('define(function () { \'use strict\';});');
      done();
    }));

    stream.write(fixture('empty.js'));
    stream.end();
  });

  it('Should properly handle files with base directories', function(done) {
    var stream = rollup({
      format: 'iife'
    });

    stream.pipe(es.through(function(file) {
      expect(file.contents.toString().replace(/\n/g, '')).toBe('(function () { \'use strict\';})();');
      done();
    }));

    stream.write(fixture('empty.js', ''));
    stream.end();
  });

  it('Should properly attach a source map', function(done) {
    var stream = rollup({
      format: 'iife',
      sourceMap: true
    });

    stream.pipe(es.through(function(file) {
      expect(file.sourceMap.version).toBeDefined();
      done();
    }));

    stream.write(fixture('empty.js', ''));
    stream.end();
  });

  it('Should properly handle multiple passed-in files', function(done) {
    var stream = rollup();

    var expected = [
      '',
      'const C = \'C\';export { C };'
    ];

    stream.pipe(es.through(function(file) {
      expect(file.contents.toString().replace(/\n/g, '')).toBe(expected.shift());
    }, function() {
      expect(expected.length).toEqual(0);
      done();
    }));

    stream.write(fixture('empty.js'));
    stream.write(fixture('nonempty.js'));
    stream.end();
  });

  it('Should emit an error when Rollup fails', function(done) {
    var stream = rollup();

    stream.on('error', function() {
      done();
    });
    stream.on('end', function() {
      done.fail('The stream ended without emitting an error.');
    });

    stream.write(fixture('fails.js'));
    stream.end();
  });
});
