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

var PLUGIN_NAME = 'gulp-rollup';


module.exports = function(options) {
  options = options || {};

  return through.obj(function(file, enc, callback) {
    var pipe = this;

    if (!file.relative) { return; }

    if (file.isStream()) {
      return pipe.emit('error',
            new PluginError(PLUGIN_NAME, 'Streaming not supported'));
    }

    options.entry = file.path;

    rollup.rollup(options).then(function(bundle){
      try {
        var res = bundle.generate(options);
        file.contents = new Buffer(res.code);
        pipe.push(file);
        callback();
      } catch (err) {
        var ge = new PluginError(PLUGIN_NAME, err.message);
        pipe.emit('error', ge);
      }
    }, function(err){
      var ge = new PluginError(PLUGIN_NAME, err.message);
      pipe.emit('error', ge);
    });
  }, function(){
    this.emit('end');
  });
};
