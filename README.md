# gulp-rollup [![npm][npm-image]][npm-url] [![Dependency Status][david-image]][david-url] [![Build Status][travis-image]][travis-url]

Gulp plugin for [Rollup](https://www.npmjs.com/package/rollup) ES6 module bundler.

## Install

```
npm i --save-dev gulp-rollup
```

## Usage

``` js
var gulp       = require('gulp'),
    rollup     = require('gulp-rollup'),
    sourcemaps = require('gulp-sourcemaps');

gulp.task('bundle', function(){
  gulp.src('src/main.js', {read: false})
    .pipe(rollup({
        // any option supported by rollup can be set here, including sourceMap
        sourceMap: true
    }))
    .pipe(sourcemaps.write(".")) // this only works if the sourceMap option is true
    .pipe(gulp.dest('dist'));
});
```

Refer to [Rollup docs](https://www.npmjs.com/package/rollup) for a list of valid options.

[npm-url]: https://npmjs.org/package/gulp-rollup
[npm-image]: https://img.shields.io/npm/v/gulp-rollup.svg
[david-url]: https://david-dm.org/mcasimir/gulp-rollup
[david-image]: https://img.shields.io/david/mcasimir/gulp-rollup/master.svg
[travis-url]: https://travis-ci.org/mcasimir/gulp-rollup
[travis-image]: https://img.shields.io/travis/mcasimir/gulp-rollup/master.svg
