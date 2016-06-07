'use strict';

var fs        = require('fs');
var path      = require('path');
var gutil     = require('gulp-util');
var es        = require('event-stream');
var assert    = require('assert');
var rollup    = require('..');
var Vinyl     = gutil.File;
var pretty    = new (require('pretty-error'))();


describe('gulp-rollup', function() {

  it('should return "console.log(this)"', function(done) {

    var content = 'console.log(this)';

    var stream = rollup();

    stream.once('data', function(file) {
      assert.equal(file.contents.toString(), content);
      done();
    });

    stream.on('error', function (e) {
      console.log(pretty.render(e));
    });

    stream.write(new Vinyl({
      path: 'src/fake.js',
      contents: new Buffer(content)
    }));

    stream.end();

  });


  it('Should properly attach a source map', function(done) {

    var file = getFile('./fixtures/nonempty.js');

    var stream = rollup({
      sourceMap: true
    });

    stream.on('error', function (e) {
      console.log(pretty.render(e));
    });

    stream.pipe(es.through(function(file) {
      expect(file.sourceMap.version).toBeDefined();
      done();
    }));

    stream.write(file);

    stream.end();

  });


  it('Should properly handle multiple passed-in files', function(done) {

    var stream = rollup();

    var expected = [
      '',
      'const C = \'C\';export { C };'
    ];


    stream.on('error', function (e) {
      console.log(pretty.render(e));
    });

    stream.pipe(es.through(function(file) {
      expect(file.contents.toString().replace(/\n/g, '')).toBe(expected.shift());
    }, function() {
      expect(expected.length).toEqual(0);
      done();
    }));

    stream.write(getFile('./fixtures/empty.js'));
    stream.write(getFile('./fixtures/nonempty.js'));
    stream.end();

  });


  it('Should emit an error when Rollup fails', function(done) {
    var stream = rollup();

    stream.on('error', function(e) {
      console.log(pretty.render(e));
      done();
    });

    stream.on('end', function() {
      done.fail('The stream ended without emitting an error.');
    });

    stream.write(getFile('fixtures/fails.js'));
    stream.end();

  });


});


/**
 * @param {string} filePath The path of the file²
 * @return {Vinyl} A Vinyl file
 */
function getFile(filePath) {

  filePath = path.isAbsolute(filePath) ?
             filePath :
             path.resolve(__dirname, filePath);

  return new Vinyl({
    path: filePath,
    contents: new Buffer(fs.readFileSync(filePath))
  });

}