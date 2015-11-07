'use strict';

var gulp          = require('gulp-help')(require('gulp'));
var jasmine       = require('gulp-jasmine');
var SpecReporter  = require('jasmine-spec-reporter');
var jshint        = require('gulp-jshint');
var jscs          = require('gulp-jscs');
var seq           = require('gulp-sequence');
var depcheck      = require('gulp-depcheck');

require('gulp-release-tasks')(gulp);

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
    'docs',
    'fixtures'
  ]
}));