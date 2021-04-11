'use strict';

var gulp          = require('gulp');
var jasmine       = require('gulp-jasmine');
var SpecReporter  = require('jasmine-spec-reporter').SpecReporter;
var jshint        = require('gulp-jshint');
var jscs          = require('gulp-jscs');

gulp.task('test', function () {
  return gulp.src(['test/**/*.spec.js'])
    .pipe(jasmine({
      reporter: new SpecReporter()
    }));
});

gulp.task('jscs', function() {
  return gulp.src(['./src/**/*.js', './test/**/*.js', '!./test/fixtures/**/*.js', './*.js'])
    .pipe(jscs())
    .pipe(jscs.reporter())
    .pipe(jscs.reporter('fail'));
});

gulp.task('jshint', function() {
  return gulp.src(['./src/**/*.js', './test/**/*.js', '!./test/fixtures/**/*.js', './*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter())
    .pipe(jshint.reporter('fail'));
});

gulp.task('lint', gulp.series('jshint', 'jscs'));

gulp.task('ci', gulp.series('lint', 'test'));
