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
  var self = this;

  Transform.call(self, { objectMode: true });

  options = options || {};

  var wonderland = {};
  var entries = [], haveSourcemaps;

  var entryFiles = Promise.resolve(options.entry).then(function(entryFiles) {
    if (typeof entryFiles === 'string') {
      return [entryFiles];
    } else if (Array.isArray(entryFiles)) {
      if (entryFiles.some(function(entryFile) {
        return typeof entryFile !== 'string';
      })) {
        throw new Error('options.entry must include only strings!');
      }
      return entryFiles;
    } else {
      throw new Error('options.entry must be a string or array of strings!');
    }
  });

  self._transform = function(file, enc, cb) {
    if (!file.isBuffer()) {
      self.emit('error', new PluginError(PLUGIN_NAME, 'Input files must be buffered!'));
      return cb();
    }

    if (haveSourcemaps === undefined) {
      haveSourcemaps = file.sourceMap !== undefined;
    } else if (haveSourcemaps !== (file.sourceMap !== undefined)) {
      self.emit('error', new PluginError(PLUGIN_NAME, 'Mixing of sourcemapped and non-sourcemapped files!'));
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

    // taking advantage of hypothetical's state-of-the-art resolving capabilities.
    var onederland = {}; // ohoho, funny pun. I laugh.
    onederland[file.path] = '';
    var finder = hypothetical({ files: onederland, allowRealFiles: true });
    // now let's see if this is an entry file.
    entryFiles = entryFiles.then(function(entryFiles) {
      entryFiles.forEach(function(entryFile, i) {
        if (finder.resolveId(entryFile)) {
          entries[i] = file;
        }
      });
      return entryFiles;
    });

    cb();
  };

  self._flush = function(cb) {
    entryFiles.then(function(entryFiles) {
      var rollup = options.rollup || require('rollup');

      return Promise.all(entryFiles.map(function(entryFile, i) {
        // don't tamper with the original options. copy them over instead.
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

        adjustedOptions.entry = entryFile;

        adjustedOptions.sourceMap = haveSourcemaps;

        return rollup.rollup(adjustedOptions).then(function(bundle) {
          var result = bundle.generate(adjustedOptions);

          // get the corresponding entry Vinyl file to output with.
          // this makes file.history work. maybe expando properties too if you use them.
          var file = entries[i];
          if (file === undefined) { // possible if options.allowRealFiles is true
            file = new File({
              path: entryFile,
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

          self.push(file);
        });
      }));
    }).then(function() {
      cb(); // it's over!
    }).catch(function(err) {
      setImmediate(function() {
        self.emit('error', new PluginError(PLUGIN_NAME, err));
        cb();
      });
    });
  };
}
util.inherits(GulpRollup, Transform);

function unixStylePath(filePath) {
  return filePath.split(path.sep).join('/');
}

module.exports = function(options) {
  return new GulpRollup(options);
};
