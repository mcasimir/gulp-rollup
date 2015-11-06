# gulp-rollup

Gulp plugin for [Rollup](https://www.npmjs.com/package/rollup) ES6 module bundler.

[![Dependency Status](https://david-dm.org/mcasimir/gulp-rollup.svg)](https://david-dm.org/mcasimir/gulp-rollup)

[![Build Status](https://travis-ci.org/mcasimir/gulp-rollup.svg)](https://travis-ci.org/mcasimir/gulp-rollup)

## Install

```
npm i --save-dev gulp-rollup
```

## Usage

``` js
var gulp   = require('gulp'),
    rollup = require('gulp-rollup');

gulp.task('bundle', function(){
  gulp.src('src/main.js', {read: false})
    .pipe(rollup(options))
    .pipe(gulp.dest('dist'));
});
```

Refer to [Rollup docs](https://www.npmjs.com/package/rollup) for a list of valid options.
