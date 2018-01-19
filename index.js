'use strict';

var PLUGIN_NAME = 'gulp-rollup';

var util         = require('util');
var PluginError  = require('plugin-error');
var File         = require('vinyl');
var Transform    = require('readable-stream').Transform;
var hypothetical = require('rollup-plugin-hypothetical');
var path         = require('path');
var bufferFrom   = require('buffer-from');

function cloneWithBlacklist(obj) {
  var out = {};

  outer:
  for (var key in obj) {
    for (var i = 1; i < arguments.length; ++i) {
      if (arguments[i] === key) {
        continue outer;
      }
    }
    out[key] = obj[key];
  }

  return out;
}

function deepEqual(a, b) {
  if (typeof a !== 'object' || typeof b !== 'object') {
    return a === b;
  }
  var key;
  for (key in a) {
    if (!(key in b) || !deepEqual(a[key], b[key])) {
      return false;
    }
  }
  for (key in b) {
    if (!(key in a)) {
      return false;
    }
  }
  return true;
}

function deExternalizePath(path) {
  if (/^(\.?\.?|[A-Za-z]:)\//.test(path)) {
    return path;
  } else {
    // path is external
    return './' + path;
  }
}

function GulpRollup(options) {
  var self = this;

  Transform.call(self, { objectMode: true });

  var options0 = options || {};
  options = cloneWithBlacklist(options0,
                               'rollup',
                               'allowRealFiles',
                               'impliedExtensions',
                               'separateCaches',
                               'generateUnifiedCache');

  var rollup = options0.rollup || require('rollup');
  var allowRealFiles = options0.allowRealFiles;

  var impliedExtensions = options0.impliedExtensions;
  if (impliedExtensions === undefined) {
    impliedExtensions = ['.js'];
  } else if (impliedExtensions !== false && !Array.isArray(impliedExtensions)) {
    throw new Error('options.impliedExtensions must be false, undefined, or an Array!');
  }

  var unifiedCachedModules = options0.generateUnifiedCache && {};

  var separateCaches = options0.separateCaches;
  if (separateCaches) {
    separateCaches = cloneWithBlacklist(separateCaches);
  }

  var wonderland = {}, vinylFiles = {};
  var haveSourcemaps;

  var inputWasNamedEntry = Boolean(options.entry);
  var inputName = inputWasNamedEntry ? 'options.entry' : 'options.input';
  var entryFiles = Promise.resolve(
    inputWasNamedEntry ? options.entry : options.input
  ).then(function(entryFiles) {
    if (typeof entryFiles === 'string') {
      return [entryFiles];
    } else if (Array.isArray(entryFiles)) {
      if (entryFiles.some(function(entryFile) {
        return typeof entryFile !== 'string';
      })) {
        throw new Error(inputName + ' must include only strings!');
      }
      return entryFiles;
    } else {
      throw new Error(inputName + ' must be a string or array of strings!');
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

    var nonExternalFilePath = deExternalizePath(file.path);

    if (haveSourcemaps) {
      wonderland[nonExternalFilePath] = {
        code: file.contents.toString(),
        map:  file.sourceMap
      };
    } else {
      wonderland[nonExternalFilePath] = file.contents.toString();
    }
    vinylFiles[nonExternalFilePath] = file;

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
      allowFallthrough: allowRealFiles,
      impliedExtensions: impliedExtensions
    }));

    if (options.output) {
      options.output.sourcemap = haveSourcemaps;
    } else {
      options.sourcemap = haveSourcemaps;
    }

    var vinylSystem = hypothetical({ files: vinylFiles, allowFallthrough: true, impliedExtensions: impliedExtensions });

    var options1 = options;

    entryFiles.then(function(entryFiles) {
      return Promise.all(entryFiles.map(function(entryFile) {
        var options = cloneWithBlacklist(options1);
        if (inputWasNamedEntry) {
          options.entry = entryFile;
        } else {
          options.input = entryFile;
        }
        if (separateCaches && Object.prototype.hasOwnProperty.call(separateCaches, entryFile)) {
          options.cache = separateCaches[entryFile];
        }

        return rollup.rollup(options).then(function(bundle) {
          self.emit('bundle', bundle, entryFile);

          if (unifiedCachedModules) {
            var modules = bundle.modules;
            for (var i = 0; i < modules.length; ++i) {
              var module = modules[i], id = module.id;
              if (Object.prototype.hasOwnProperty.call(unifiedCachedModules, id)) {
                if (!deepEqual(module, unifiedCachedModules[id])) {
                  throw new Error('Conflicting caches for module "' + id + '"!');
                }
              } else {
                unifiedCachedModules[id] = module;
              }
            }
          }

          return bundle.generate(options);
        }).then(function(result) {
          // get the corresponding entry Vinyl file to output with.
          // this makes file.history work. maybe expando properties too if you use them.
          var file = vinylSystem.resolveId(entryFile);
          if (file !== undefined) {
            file = vinylSystem.load(file);
          }
          if (file === undefined) { // possible if options.allowRealFiles is true
            file = new File({
              path: entryFile,
              contents: bufferFrom(result.code)
            });
          } else {
            file.contents = bufferFrom(result.code);
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
      if (unifiedCachedModules) {
        var modules = [];
        for (var id in unifiedCachedModules) {
          modules.push(unifiedCachedModules[id]);
        }
        self.emit('unifiedcache', { modules: modules });
      }
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
