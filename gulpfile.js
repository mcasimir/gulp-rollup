'use strict';

let gulp          = require('gulp-help')(require('gulp'));
let jasmine       = require('gulp-jasmine');
let SpecReporter  = require('jasmine-spec-reporter');
let jshint        = require('gulp-jshint');
let jscs          = require('gulp-jscs');
let seq           = require('gulp-sequence');
let depcheck      = require('gulp-depcheck');

require('gulp-release-tasks')(gulp);

gulp.task('test', function () {
  return gulp.src(['test/**/*.spec.js'])
        .pipe(jasmine({
          reporter: new SpecReporter()
        }));
});

gulp.task('jscs', function() {
  return gulp.src(['./src/**/*.js', './test/**/*.js', './*.js'])
    .pipe(jscs())
    .pipe(jscs.reporter())
    .pipe(jscs.reporter('fail'));
});

gulp.task('jshint', function() {
  return gulp.src(['./src/**/*.js', './test/**/*.js', './*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter())
    .pipe(jshint.reporter('fail'));
});

gulp.task('lint', seq('jshint', 'jscs'));

gulp.task('ci', seq('depcheck', 'lint', 'test'));

gulp.task('default', () => {
  return gulp.src('src/app.js')
    .pipe(gulp.dest('src'));
});

gulp.task('depcheck', depcheck({
  ignoreDirs: [
    'node_modules',
    'bower_components',
    'docs'
  ]
}));