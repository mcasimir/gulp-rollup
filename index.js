'use strict';

/**
 * @usage
 *
 * gulp.src('app.js', {read: false})
 * 		 .pipe(rollup(options))
 * 		 .pipe(gulp.dest('dist'));
 */

var through     = require('through2'),
    gutil       = require('gulp-util'),
    PluginError = gutil.PluginError,
    fs          = require('fs'),
    rollup      = require('rollup'),
    PLUGIN_NAME = 'gulp-rollup';

module.exports = function(options) {
  options = options || {};

  return through.obj(function(file, enc, callback) {
    var _this = this;

    if (!file.relative) { return; }

    if (file.isStream()) {
      return _this.emit('error',
        new PluginError(PLUGIN_NAME, 'Streaming not supported'));
    }

    try {
      var stats = fs.lstatSync(file.relative);
      if (stats.isFile()) {
        options.entry = file.path;

        rollup.rollup(options).then(function(bundle){
          try {
            var res = bundle.generate(options);
            file.contents = new Buffer(res.code);
            _this.push(file);
            callback();
          } catch (err) {
            var ge = new PluginError(PLUGIN_NAME, err.message);
            _this.emit('error', ge);
          }
        }, function(err){
          var ge = new PluginError(PLUGIN_NAME, err.message);
          _this.emit('error', ge);
        });  
      }
    }
    catch (err) {
      return _this.emit('error',
        new PluginError(PLUGIN_NAME, err.message));
    }
  }, function(){
    this.emit('end');
  });
};
