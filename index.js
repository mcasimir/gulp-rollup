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
    if (!file.path) { return; }

    if (file.isStream()) {
      callback(new PluginError(PLUGIN_NAME, 'Streaming not supported'));
      return;
    }

    try {
      var stats = fs.lstatSync(file.path);
      if (stats.isFile()) {
        options.entry = file.path;

        rollup.rollup(options).then(function(bundle) {
          try {
            var res = bundle.generate(options);
            file.contents = new Buffer(res.code);
            callback(null, file);
          } catch (err) {
            callback(new PluginError(PLUGIN_NAME, err));
          }
        }, function(err) {
          callback(new PluginError(PLUGIN_NAME, err));
        });
      }
    } catch (err) {
      callback(new PluginError(PLUGIN_NAME, err));
    }
  }, function() {
    this.emit('end');
  });
};
