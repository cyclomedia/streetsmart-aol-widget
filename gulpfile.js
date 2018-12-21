var gulp = require('gulp');
var babel = require('gulp-babel');
var livereload = require('gulp-livereload');
require('dotenv').config();

console.log('WIDGET DIRECTORY: ', process.env.WIDGET_DIR);

gulp.task('babel', function() {
    return gulp.src([
        'src/**/*.js', '!**/*___jb_old___'
    ])
        .pipe(babel())
        .pipe(gulp.dest('dist'))
        .pipe(gulp.dest(process.env.WIDGET_DIR))
        .pipe(livereload());
});

gulp.task('copy', function() {
    // Also copy all non javascript files to the dist folder
    gulp.src(['src/**/*.*', '!src/**/*.js', '!**/*___jb_old___'], { base: 'src' })
        .pipe(gulp.dest('dist'))
        .pipe(gulp.dest(process.env.WIDGET_DIR));

    gulp.src(['assets/**/*.*', '!**/*___jb_old___'], { base: 'assets' })
        .pipe(gulp.dest('dist'))
        .pipe(gulp.dest(process.env.WIDGET_DIR))
        .pipe(livereload());
});

gulp.task('default', ['babel', 'copy']);

gulp.task('watch', function() {
    livereload.listen();
    gulp.watch(['src/**/*.*', 'assets/**/*.*'], ['default']);
});
