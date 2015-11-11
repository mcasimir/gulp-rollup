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
    path        = require('path'),
    rollup      = require('rollup'),
    PLUGIN_NAME = 'gulp-rollup';

module.exports = function(options) {
  options = options || {};

  return through.obj(function(file, enc, callback) {
    if (!file.path) { return callback(); }

    if (file.isStream()) {
      return callback(new PluginError(PLUGIN_NAME, 'Streaming not supported'));
    }

    try {
      var stats = fs.lstatSync(file.path);
      if (stats.isFile()) {
        options.entry = file.path;

        rollup.rollup(options).then(function(bundle) {
          var res = bundle.generate(options);
          file.contents = new Buffer(res.code);
          var map = res.map;
          if (map) {
            // This makes sure the paths in the generated source map (file and
            // sources) are relative to file.base:
            map.file = unixStylePath(file.relative);
            map.sources = map.sources.map(function(fileName) {
              return unixStylePath(path.relative(file.base, fileName));
            });
            file.sourceMap = map;
          }
          callback(null, file);
        }, function(err) {
          setImmediate(function() {
            callback(new PluginError(PLUGIN_NAME, err));
          });
        });
      }
    } catch (err) {
      callback(new PluginError(PLUGIN_NAME, err));
    }
  }, function() {
    this.emit('end');
  });
};

function unixStylePath(filePath) {
  return filePath.split(path.sep).join('/');
}
