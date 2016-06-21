'use strict';

var PLUGIN_NAME = 'gulp-rollup';

var util         = require('util');
var gutil        = require('gulp-util');
var PluginError  = gutil.PluginError;
var File         = gutil.File;
var Transform    = require('readable-stream').Transform;
var hypothetical = require('rollup-plugin-hypothetical');
var path         = require('path');

function GulpRollup(options) {
  Transform.call(this, { objectMode: true });

  options = options || {};

  var wonderland = {};
  var entry, haveSourcemaps;

  this._transform = function(file, enc, cb) {
    if (!file.isBuffer()) {
      this.emit('error', new PluginError(PLUGIN_NAME, 'Input files must be buffered!'));
      return cb();
    }

    if (haveSourcemaps === undefined) {
      haveSourcemaps = file.sourceMap !== undefined;
    } else if (haveSourcemaps !== (file.sourceMap !== undefined)) {
      this.emit('error', new PluginError(PLUGIN_NAME, 'Mixing of sourcemapped and non-sourcemapped files!'));
      return cb();
    }

    if (haveSourcemaps) {
      wonderland[file.path] = {
        code: file.contents.toString(),
        map:  file.sourceMap
      };
    } else {
      wonderland[file.path] = file.contents.toString();
    }

    if (!entry && options.entry && hypothetical({ files: wonderland, allowRealFiles: true }).resolveId(options.entry)) {
      entry = file;
    }

    cb();
  };

  this._flush = function(cb) {
    var _this = this;
    try {
      var rollup = options.rollup || require('rollup');

      var adjustedOptions = {};
      for (var key in options) {
        if (key !== 'rollup' && key !== 'allowRealFiles') {
          adjustedOptions[key] = options[key];
        }
      }

      if (!adjustedOptions.plugins) {
        adjustedOptions.plugins = [];
      } else if (!Array.isArray(adjustedOptions.plugins)) {
        adjustedOptions.plugins = [adjustedOptions.plugins];
      }
      adjustedOptions.plugins = adjustedOptions.plugins.concat(hypothetical({
        files: wonderland,
        allowRealFiles: options.allowRealFiles
      }));

      rollup.rollup(adjustedOptions).then(function(bundle) {
        adjustedOptions.sourceMap = haveSourcemaps;

        var result = bundle.generate(adjustedOptions);

        var file = entry;
        if (file === undefined) { // possible if options.allowRealFiles is true
          file = new File({
            path: options.entry,
            contents: new Buffer(result.code)
          });
        } else {
          file.contents = new Buffer(result.code);
        }

        var map = result.map;
        if (map) {
          // This makes sure the paths in the generated source map (file and
          // sources) are relative to file.base:
          map.file = unixStylePath(file.relative);
          map.sources = map.sources.map(function(fileName) {
            return unixStylePath(path.relative(file.base, fileName));
          });
          file.sourceMap = map;
        }

        _this.push(file);

        cb();
        _this.emit('end');
      }).catch(function(err) {
        setImmediate(function() {
          _this.emit('error', new PluginError(PLUGIN_NAME, err));
          cb();
        });
      });
    } catch (err) {
      this.emit('error', new PluginError(PLUGIN_NAME, err));
      cb();
    }
  };
}
util.inherits(GulpRollup, Transform);

function unixStylePath(filePath) {
  return filePath.split(path.sep).join('/');
}

module.exports = function(options) {
  return new GulpRollup(options);
};
