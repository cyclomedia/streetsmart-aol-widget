const gulp = require('gulp');
const babel = require('gulp-babel');
const livereload = require('gulp-livereload');
require('dotenv').config();

console.log('WIDGET DIRECTORY: ', process.env.WIDGET_DIR);

const babelify = () => gulp.src(['src/**/*.js', '!src/packages/**/*.*', '!**/*___jb_old___'])
    .pipe(babel())
    .pipe(gulp.dest('dist/CyclomediaAOL_Widget/'))
    .pipe(gulp.dest(process.env.WIDGET_DIR))
    .pipe(livereload());

const copyAssets = () => gulp.src(['assets/**/*.*', '!**/*___jb_old___'], { base: 'assets' })
    .pipe(gulp.dest('dist/CyclomediaAOL_Widget/'))
    .pipe(gulp.dest(process.env.WIDGET_DIR))
    .pipe(livereload());


const copySource = () => gulp.src(['src/**/*.*', '!src/**/*.js', '!**/*___jb_old___'], { base: 'src' })
    .pipe(gulp.dest('dist/CyclomediaAOL_Widget/'))
    .pipe(gulp.dest(process.env.WIDGET_DIR));

const copyPackages = () => gulp.src(['src/packages/*.*', '!**/*___jb_old___'], { base: 'src' })
    .pipe(gulp.dest('dist/CyclomediaAOL_Widget/'))
    .pipe(gulp.dest(process.env.WIDGET_DIR));

const copyRedirect = () => gulp.src(['src/redirect/*.*', '!**/*___jb_old___'], { base: 'src' })
    .pipe(gulp.dest('dist/CyclomediaAOL_Widget/'))
    .pipe(gulp.dest(process.env.WIDGET_DIR));

const copyPackagejson = () => gulp.src(['package.json', 'package-lock.json'])
    .pipe(gulp.dest('dist/CyclomediaAOL_Widget/'))
    .pipe(gulp.dest(process.env.WIDGET_DIR));

const copyFromNodeModules = () => gulp.src(['./node_modules/oidc-client-ts/dist/browser/oidc-client-ts.min.js'])
    .pipe(gulp.dest('src/redirect/'))
    .pipe(gulp.dest(process.env.WIDGET_DIR));

// Also copy all non javascript files to the dist folder
const copy = done => gulp.parallel(copySource, copyAssets, copyPackages, copyRedirect, copyPackagejson)(done);

const main = done => gulp.series(babelify, copyFromNodeModules, copy)(done);

const watch = () => {
    livereload.listen();
    gulp.watch(['src/**/*.*', 'assets/**/*.*'], main);
}

exports.default = main;
exports.babel = babelify;
exports.copy = copy;
exports.watch = watch;
