const { src, dest, task, series, watch, parallel } = require('gulp');
const rm = require('gulp-rm'), // удаление файлов
    sass = require('gulp-sass'), // SASS
    concat = require('gulp-concat'), // соединение файлов в один
    browserSync = require('browser-sync').create(), // dev-Server
    reload = browserSync.reload, // функция перезагрузки dev-Server
    sassGlob = require('gulp-sass-glob'), // продвинутый импорт стилей
    autoprefixer = require('gulp-autoprefixer'), // автопрефиксер
    px2rem = require('gulp-smile-px2rem'), // перевод из px в rem
    gcmq = require('gulp-group-css-media-queries'), // группировка одинаковых медиазапросов  
    cleanCSS = require('gulp-clean-css'), // минификация css
    sourcemaps = require('gulp-sourcemaps'), // source maps
    babel = require('gulp-babel'), // ES 6 -> браузеросовместимый код
    uglify = require('gulp-uglify'), // минификация js
    notify = require("gulp-notify"), // уведомления 
    wait = require('gulp-wait2'), // задержка
    gulpif = require('gulp-if'); // плагин условия
const eslint = require('gulp-eslint');

const env = process.env.NODE_ENV; // env - переменная из переменных окружения node.js, определяется в package.json

const { SRC_PATH, DIST_PATH, STYLES_LIBS, JS_LIBS } = require('./gulp.config');
sass.compiler = require('node-sass');

task('clean', () => {
    return src(`${DIST_PATH}/**/*`, { read: false }).pipe(rm());
});

task('styles', () => {
    return src([...STYLES_LIBS, `${SRC_PATH}/styles/main.scss`])
        .pipe(gulpif(env === 'dev', sourcemaps.init()))
        .pipe(concat('main.min.scss'))
        .pipe(sassGlob())
        .pipe(wait(1500))
        .pipe(sass({ outputStyle: 'expand' }).on("error", notify.onError()))
        .pipe(px2rem({
            dpr: 1, // base device pixel ratio (default: 2)
            rem: 16, // root element (html) font-size (default: 16)
            one: false // whether convert 1px to rem (default: false)
        }))
        .pipe(gulpif(env === 'dev', autoprefixer({ cascade: false })))
        .pipe(gulpif(env === 'build', gcmq()))
        .pipe(gulpif(env === 'build', cleanCSS()))
        .pipe(gulpif(env === 'dev', sourcemaps.write()))
        .pipe(dest(`${DIST_PATH}`))
        .pipe(reload({ stream: true }));
});

task('scripts', () => {
    return src([...JS_LIBS, `${SRC_PATH}/scripts/**/*.js`])
        .pipe(gulpif(env === 'dev', sourcemaps.init()))
        .pipe(concat('main.min.js', { newLine: ";" }))
        .pipe(gulpif(env === 'build', babel({ presets: ['@babel/env'] })))
        .pipe(gulpif(env === 'build', uglify()))
        .pipe(gulpif(env === 'dev', sourcemaps.write()))
        .pipe(dest(`${DIST_PATH}`))
        .pipe(reload({ stream: true }));
});

task('eslint', () => {
    return src([...JS_LIBS, `${SRC_PATH}/scripts/**/*.js`])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError())
})
task("copy:img", () => {
    return src(`${SRC_PATH}/images/*.*`)
        .pipe(dest(`${DIST_PATH}/images`))
        .pipe(reload({ stream: true }));
});

task("copy:favicon", () => {
    return src(`${SRC_PATH}/images/favicon/favicon.*`)
        .pipe(dest(`${DIST_PATH}`))
        .pipe(reload({ stream: true }));
});

task("copy:fonts", () => {
    return src(`${SRC_PATH}/fonts/**/*.*`)
        .pipe(dest(`${DIST_PATH}/fonts`))
        .pipe(reload({ stream: true }));
});

task("copy:html", () => {
    return src(`${SRC_PATH}/pages/**/*.*`)
        .pipe(dest(`${DIST_PATH}`))
        .pipe(reload({ stream: true }));
});

task('server', () => {
    browserSync.init({
        server: {
            baseDir: `./${DIST_PATH}`
        },
        open: false
    });
});

task('watch', () => {
    watch(`./${SRC_PATH}/pages/**/*.html`, series('copy:html'));
    watch(`./${SRC_PATH}/styles/**/*.scss`, series('styles'));
    watch(`./${SRC_PATH}/scripts/**/*.js`, series('scripts'));
})

// таск по умолчанию (gulp)
task('default',
    series('clean',
        parallel('copy:img', 'copy:fonts', 'copy:favicon', 'copy:html'),
        parallel('styles', 'scripts', /* 'icons', */ ),
        parallel('watch', 'server')
    )
);

task('build',
    series('clean',
        parallel('copy:img', 'copy:fonts', 'copy:favicon', 'copy:html'),
        parallel('styles', 'scripts', /* 'icons', */ )
    )
);

task('codestyle',
    series('eslint')
);