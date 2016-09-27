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

  var options0 = options || {};
  options = {};
  for (var key in options0) {
    if (key !== 'rollup' && key !== 'allowRealFiles' && key !== 'impliedExtensions') {
      options[key] = options0[key];
    }
  }

  var rollup = options0.rollup || require('rollup');
  var allowRealFiles = options0.allowRealFiles;
  var impliedExtensions = options0.impliedExtensions;

  var wonderland = {}, vinylFiles = {};
  var haveSourcemaps;

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
    vinylFiles[file.path] = file;

    cb();
  };

  self._flush = function(cb) {
    if (!options.plugins) {
      options.plugins = [];
    } else if (!Array.isArray(options.plugins)) {
      options.plugins = [options.plugins];
    }
    options.plugins = options.plugins.concat(hypothetical({
      files: wonderland,
      allowRealFiles: allowRealFiles,
      impliedExtensions: impliedExtensions
    }));

    var vinylSystem = hypothetical({ files: vinylFiles, allowRealFiles: true, impliedExtensions: impliedExtensions });

    entryFiles.then(function(entryFiles) {
      return Promise.all(entryFiles.map(function(entryFile) {
        options.entry = entryFile;

        options.sourceMap = haveSourcemaps;

        return rollup.rollup(options).then(function(bundle) {
          var result = bundle.generate(options);

          // get the corresponding entry Vinyl file to output with.
          // this makes file.history work. maybe expando properties too if you use them.
          var file = vinylSystem.resolveId(entryFile);
          if (file !== undefined) {
            file = vinylSystem.load(file);
          }
          if (file === undefined) { // possible if options.allowRealFiles is true
            file = new File({
              path: entryFile,
              contents: process.version[1] < 6 ? new Buffer(result.code) : Buffer.from(result.code),
            });
          } else {
            file.contents = process.version[1] < 6 ? new Buffer(result.code) : Buffer.from(result.code);
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
