var path = require('path');


/**
 * Create a rollup plugin to pass Vinyl file to rollup
 *
 * @param {Object} file A vinyl file
 */
function RollupPluginVinyl(file) {

  /** @type {string} */
  var normalized = RollupPluginVinyl.unix(file.path);

  return {

    /**
     * @param {string} importee Import's id.
     * @param {string} importer Tmporter's id.
     * @return {string|null|undefined|false} id The resolved id.
     */
    resolveId: function (importee, importer) {

      var id = null;

      if (normalized === importee) {
        id = importee;
      } else if (normalized === importer) {
        id = RollupPluginVinyl.unix(path.resolve(
          path.dirname(importer),
          importee
        ));
      }

      return id;
    },

    /**
     * @param {string} id The id to load.
     * @return {string} The file content
     */
    load: function (id) {
      return id === normalized ? file.contents.toString() : null;
    }

  };

}


/**
 * Transform native path to Unix path style
 *
 * @param {string} value A path.
 * @return {string} a unix style path;
 */
RollupPluginVinyl.unix = function unix(value) {
  return value.split(path.sep).join('/');
}


module.exports = RollupPluginVinyl;