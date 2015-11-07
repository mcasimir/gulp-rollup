'use strict';

var gutil       = require('gulp-util');
var rollupLib   = require('rollup');
var es          = require('event-stream');
var rollup      = require('..');

function fixture(path) {
  return new gutil.File({
    path: __dirname + '/fixtures/' + path,
    contents: null
  });
}

describe('gulp-rollup', function() {
  it('Should throw with non existing entry file', function() {
    var stream = rollup();
    
    expect(function() {
      stream.write(fixture('notfound.js'));
    }).toThrowError(/ENOENT/);

    stream.end();
  });

  it('Should pass source as entry to rollup', function(done) {
    spyOn(rollupLib, 'rollup').and.callThrough();
    var stream = rollup();

    stream.pipe(es.through(function() {
      expect(rollupLib.rollup).toHaveBeenCalledWith({ entry: fixture('empty.js').path });
      done();
    }));

    stream.write(fixture('empty.js'));
    stream.end();
  });

  it('Should override entry option', function(done) {
    spyOn(rollupLib, 'rollup').and.callThrough();
    var stream = rollup({entry: 'overridden.js'});

    stream.pipe(es.through(function() {
      expect(rollupLib.rollup).toHaveBeenCalledWith({ entry: fixture('empty.js').path });
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
});