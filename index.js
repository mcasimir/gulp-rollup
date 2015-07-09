/**
 * @usage
 *
 * gulp.src('app.js', {read: false})
 * 		 .pipe(rollup(options))
 * 		 .pipe(gulp.dest('dist'));
 */

var path = require('path'),
  through = require('through2'),
  gutil = require('gulp-util'),
  PluginError = gutil.PluginError,
  File = gutil.File,
  rollup = require('rollup');

module.exports = function(options) {
  options = options || {};

  return through.obj(function(file, enc, callback) {
    var pipe = this;

    if (!file.relative) { return; }

    if (file.isStream()) {
      return pipe.emit('error',
            new PluginError('gulp-rollup', 'Streaming not supported'));
    }

    options.entry = file.path;

    rollup.rollup(options).then(function(bundle){
      var res = bundle.generate(options);
      file.contents = new Buffer(res.code);
      pipe.push(file);
      callback();
    }, function(err){
      console.error(err);
      pipe.emit('error',
            new PluginError('gulp-rollup', err));
      callback(err);
    });
  });
};
