# gulp-rollup

Gulp plugin for [Rollup](https://www.npmjs.com/package/rollup) ES6 module bundler.

## Install

```
npm i --save-dev gulp-rollup
```

## Usage

``` js
gulp.task('bundle', function(){
  gulp.src('src/main.js', {read: false})
  		 .pipe(rollup(options))
  		 .pipe(gulp.dest('dist'));
});
```

Refer to [Rollup docs](https://www.npmjs.com/package/rollup) for a list of valid options.
