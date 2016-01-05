var gulp = require("gulp"),
	
	jade = require("gulp-jade"),

	stylus = require("gulp-stylus"),
	nib = require("nib"),

	spritesmith = require("gulp.spritesmith"),
	imagemin = require("gulp-imagemin"),
	pngquant = require("imagemin-pngquant"),

	browserSync = require("browser-sync").create(),

	zip = require("gulp-zip"),
	util = require("gulp-util"),
	ftp = require("gulp-ftp"),

	runSequence = require("run-sequence"),
	merge = require("merge-stream"),
	watch = require("gulp-watch"),
	file = require("file"),
	fs = require("fs"),
	path = require("path"),
	request = require("request"),
	data = require("gulp-data"),
	jsonfile = require("jsonfile"),
	settings = jsonfile.readFileSync("./settings.json");



// Страницы для верстки
gulp.task("pages", function() {
	return gulp.src(settings.paths.dev.pages + "*.jade")
		.pipe(data(function(file) {
			var fileCode = path.basename(file.path).replace(".jade", "");
			return {
				info: settings.info,
				page: settings.pages[fileCode]
			};
		}))
		.pipe(jade({
			pretty: true
		}))
		.pipe(gulp.dest(settings.paths.prod.pages))
		.pipe(browserSync.reload({
			stream: true
		}));
});



// Создание архива верстки
gulp.task("compress", function() {
	
	var archiveName = ''
		date = new Date();

	// Формирование имени архива
	archiveName += settings.info.code + "_" + date.getDate() + "-" + (date.getMonth() + 1 < 10 ? ("0" + (date.getMonth() + 1)) : date.getMonth() + 1) + "-" + date.getFullYear();
	archiveName += "_" + date.getHours() + "-" + (date.getMinutes() < 10 ? ("0" + date.getMinutes()) : date.getMinutes());
	archiveName += ".zip";

	// Архивация необходимых файлов
	gulp.src([settings.paths.prod.root + "*", settings.paths.prod.root + "**", "!" + settings.paths.prod.archives, "!" + settings.paths.prod.archives + "*"])
		.pipe(zip(archiveName))
		.pipe(gulp.dest(settings.paths.prod.archives));
});



// Главная страница со списком всех страниц
gulp.task("front", function() {

	// Получение списка архивов
	var archives = [],
		archive;
	file.walk(settings.paths.prod.archives, function(n, dirName, dirPaths, files) {
		if(files) {
			// Получение файлов архивов из директории
			for(var i = 0, len = files.length; i < len; i++) {

				var filePath = files[i].split("\\"),
					fileName = filePath[filePath.length - 1].replace(".zip", ""),
					fileInfo = fileName.split("_"),
					fileDate = fileInfo[1].replace(/-/g, "."),
					fileTime = fileInfo[2].replace(/-/g, ":");

				// Информация о файле
				var fileStats = fs.statSync(files[i]);

				archives.push({
					name: fileInfo[0],
					size: (fileStats.size / 1024 / 1024).toFixed(2),
					date: fileDate + " " + fileTime,
					dateFormat: new Date(fileDate + " " + fileTime).getTime(),
					url: settings.info.productionUrl + "archives/" + fileName + ".zip"
				});
			}

			// Сортировка по убыванию времени создания
			archives.sort(function(a, b) {
				if(a.dateFormat == b.dateFormat) {
					return 0;
				}
				return (a.dateFormat < b.dateFormat) ? 1 : -1;
			});
		}

		// Формирование html страницы
		gulp.src(settings.paths.dev.root + "index.jade")
			.pipe(jade({
				locals: {
					info: settings.info,
					pages: settings.pages,
					archives: archives
				},
				pretty: true
			}))
			.pipe(gulp.dest(settings.paths.prod.root))
			.pipe(browserSync.reload({
				stream: true
			}));
	});
});



// Стили
gulp.task("css", function() {
	gulp.src(settings.paths.dev.css + "*.styl")
		.pipe(stylus({
			use: [nib()]
		}))
		.pipe(gulp.dest(settings.paths.prod.css))
		.pipe(browserSync.reload({
			stream: true
		}));
});



// Генерация спрайтов
gulp.task("sprite", function() {

	var spriteData = gulp.src(settings.paths.dev.icons + "*.png")
		.pipe(spritesmith({
			imgName: "sprite.png",
			cssName:"sprite.styl",
			cssTemplate: settings.paths.dev.cssLib + "sprite.styl.mustache",
			padding: 20
		}));

	var imgStream = spriteData.img
		.pipe(gulp.dest(settings.paths.dev.images));

	var cssStream = spriteData.css
		.pipe(gulp.dest(settings.paths.dev.css));

	return merge(imgStream, cssStream);
});



// Картинки стилей
gulp.task("images", function() {
	gulp.src([settings.paths.dev.images + "*", settings.paths.dev.images + "**"])
		.pipe(imagemin({
			progressive: true,
			svgoPlugins: [{removeViewBox: false}],
			use: [pngquant(settings.paths.prod.images)]
		}))
		.pipe(gulp.dest(settings.paths.prod.images));
});



// JS
gulp.task("js", function() {
	gulp.src([settings.paths.dev.js + "*", settings.paths.dev.js + "**"])
		.pipe(gulp.dest(settings.paths.prod.js));
});



// Контентная медиа
gulp.task("dummy", function() {
	gulp.src([settings.paths.dev.dummy + "*", settings.paths.dev.dummy + "**"])
		.pipe(gulp.dest(settings.paths.prod.dummy));
});



// Загрузка на демо-сервер
gulp.task("upload", function() {
	gulp.src([settings.paths.prod.root + "*", settings.paths.prod.root + "**"])
		.pipe(ftp({
			host: settings.ftp.host,
			user: settings.ftp.login,
			pass: settings.ftp.password,
			remotePath: "/projects/" + settings.info.code
		}))
		.pipe(util.noop())
});



// Очистка директории проекта на демо-сервере
gulp.task("cleanfolder", function() {
	request("http://wemakesites.ru/projects/cleanfolder.php?directory=" + settings.info.code, function() {
		return true;
	});
});



// Веб-сервер
gulp.task("browser-sync", function() {
	browserSync.init({
		server: {
			baseDir: [settings.paths.prod.root, settings.paths.prod.pages]
		},
		open: false
	});
});



// Создание базовых файлов и директорий проекта
gulp.task("assembly", function() {
	
	// Pages
	if(!fs.existsSync(settings.paths.dev.pages)) {
		fs.mkdirSync(settings.paths.dev.pages);
	}
	for(var pageCode in settings.pages) {
		var page = settings.paths.dev.pages + pageCode + ".jade";
		if(!fs.existsSync(page)) {
			fs.writeFile(page, "");
		}
	};

	// Templates
	var templateFilePath = settings.paths.dev.templates + "base.jade",
		baseTemplateFilePath = settings.paths.dev.htmlLib + "template.jade";

	if(!fs.existsSync(settings.paths.dev.templates)) {
		fs.mkdirSync(settings.paths.dev.templates);
	}
	if(!fs.exists(templateFilePath)) {
		fs.writeFile(templateFilePath, fs.readFileSync(baseTemplateFilePath, "utf8"));
	}

	// CSS
	var cssFilePath = settings.paths.dev.css + settings.info.code + ".styl",
		baseCssFilePath = settings.paths.dev.cssLib + "markup.styl";
	
	if(!fs.existsSync(settings.paths.dev.css)) {
		fs.mkdirSync(settings.paths.dev.css);
	}
	if(!fs.existsSync(cssFilePath)) {
		fs.writeFile(cssFilePath, fs.readFileSync(baseCssFilePath, "utf8"));
	}

	// JS
	var jsFilePath = settings.paths.dev.js + settings.info.code + ".js",
		baseJsFilePath = settings.paths.dev.jsLib + "markup.js";

	if(!fs.existsSync(settings.paths.dev.js)) {	
		fs.mkdirSync(settings.paths.dev.js);
	}
	if(!fs.existsSync(jsFilePath)) {
		fs.writeFile(jsFilePath, fs.readFileSync(baseJsFilePath, "utf8").replace("XXX", settings.info.code.toUpperCase()));
	}

	// Images
	if(!fs.existsSync(settings.paths.dev.images)) {	
		fs.mkdirSync(settings.paths.dev.images);
	}
	if(!fs.existsSync(settings.paths.dev.icons)) {
		fs.mkdirSync(settings.paths.dev.icons);	
	}
	
	// Dummy
	if(!fs.existsSync(settings.paths.dev.dummy)) {	
		fs.mkdirSync(settings.paths.dev.dummy);
	}

});



gulp.task("default", ["browser-sync"], function() {

	// Картинки и иконки
	watch([settings.paths.dev.images + "*", settings.paths.dev.images + "svg/*"], function(e) {
		gulp.start("images");
	});
	watch([settings.paths.dev.icons + "*"], function(e) {
		runSequence(
			["images"],
			["sprite"]
		);
	});

	// Контентная медиа
	watch([settings.paths.dev.dummy + "*", settings.paths.dev.dummy + "**"], function(e) {
		gulp.start("dummy");
	});

	// CSS
	watch([settings.paths.dev.css + "*.styl", settings.paths.dev.cssLib + "*.styl"], function(e) {
		gulp.start("css");
	});
	
	// HTML
	watch([settings.paths.dev.pages + "*.jade", settings.paths.dev.templates + "*.jade", settings.paths.dev.htmlLib + "*.jade"], function(e) {
		gulp.start("pages");
	});

	// Главная страница
	watch([settings.paths.dev.root + "index.jade", "./settings.json"], function() {
		settings = jsonfile.readFileSync("./settings.json");
		runSequence(
			["front", "pages"]
		);
	});

});

// Создание версии для production
gulp.task("production", function() {
	runSequence(
		["front", "pages", "dummy", "js"],
		["sprite"],
		["css"],
		["images"]
	);
});

// Создание нового архива верстки
gulp.task("archive", function() {
	runSequence(
		["compress"],
		["front"]
	);
});

// Выгрузка на демо-сервер
gulp.task("deploy", function() {
	runSequence(
		["cleanfolder"],
		["upload"]
	);
});

// Чудо-команда
gulp.task("make", function() {
	runSequence(
		["assembly"],
		["front", "pages", "dummy", "js"],
		["sprite"],
		["css"],
		["images"],
		["compress", "front"],
		["cleanfolder", "upload"]
	);
});