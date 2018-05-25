var gulp = require('gulp');
var babel = require('gulp-babel');
require('dotenv').config();

console.log('WIDGET DIRECTORY: ', process.env.WIDGET_DIR);

gulp.task('babel', function() {
    return gulp.src([
        'src/**/*.js',
    ])
        .pipe(babel())
        .pipe(gulp.dest('dist'))
        .pipe(gulp.dest(process.env.WIDGET_DIR));
});

gulp.task('copy', function() {
    // Also copy all non javascript files to the dist folder
    gulp.src(['src/**/*.*', '!src/**/*.js'], { base: 'src' })
        .pipe(gulp.dest('dist'))
        .pipe(gulp.dest(process.env.WIDGET_DIR));

    gulp.src('assets/**/*.*', { base: 'assets' })
        .pipe(gulp.dest('dist'))
        .pipe(gulp.dest(process.env.WIDGET_DIR));
});

gulp.task('default', ['babel', 'copy']);

gulp.task('watch', function() {
    gulp.watch(['src/**/*.*', 'assets/**/*.*'], ['default']);
});