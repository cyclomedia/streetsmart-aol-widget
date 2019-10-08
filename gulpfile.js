const gulp = require('gulp');
const babel = require('gulp-babel');
const livereload = require('gulp-livereload');
require('dotenv').config();

console.log('WIDGET DIRECTORY: ', process.env.WIDGET_DIR);

const babelify = () => gulp.src(['src/**/*.js', '!**/*___jb_old___'])
    .pipe(babel())
    .pipe(gulp.dest('dist'))
    .pipe(gulp.dest(process.env.WIDGET_DIR))
    .pipe(livereload());

const copyAssets = () => gulp.src(['assets/**/*.*', '!**/*___jb_old___'], { base: 'assets' })
    .pipe(gulp.dest('dist'))
    .pipe(gulp.dest(process.env.WIDGET_DIR))
    .pipe(livereload());


const copySource = () => gulp.src(['src/**/*.*', '!src/**/*.js', '!**/*___jb_old___'], { base: 'src' })
    .pipe(gulp.dest('dist'))
    .pipe(gulp.dest(process.env.WIDGET_DIR));

// Also copy all non javascript files to the dist folder
const copy = done => gulp.parallel(copySource, copyAssets)(done);

const main = done => gulp.series(babelify, copy)(done);

const livereloading = done => {
    livereload.listen();
    done();
};

const watch = () => gulp.watch(['src/**/*.*', 'assets/**/*.*'], gulp.series(main, livereloading));

exports.default = main;
exports.babel = babelify;
exports.copy = copy;
exports.watch = watch;
