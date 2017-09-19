'use strict';
const fs = require('fs-extra');
const ncp = require('ncp');
const path = require('path');
const mkdirp = require('mkdirp');
const helpers = require('@webpack-common/helpers');
const pkg = require('@root/package.json');
const urlJoin = require('url-join');

/**
 * This function takes the font list from the consumed settings file, and a target filename where the font import
 * statements will go. It first uses the fonts list to determine which fonts are imported dynamically as webfonts and
 * creates corresponding CSS @import statements and writes them to the target file provided by `targetFilename`
 *
 * Then, it converts the font settings JSON into a SASS map string, which is passed back to the webpack environment and
 * injected into the SASS environment.
 *
 * @param fonts
 * @param targetFilename
 * @returns {string}
 */
function parseFontConfigToSass(fonts, targetFilename) {
    let masterStr = '';
    let scssFontImportStmts = fonts.reduce((accumulator, font) => font.generated ? `${accumulator}@import "./${font.name}";\n` : accumulator, '');

    mkdirp(path.dirname(targetFilename), function (err) {
        if (err) {
            throw new Error(`Couldn't write font scss file! Aborting.\n`, err);
        }
        fs.writeFileSync(targetFilename, scssFontImportStmts);
    });

    fonts.forEach(font => {
        switch (font.type) {
            case 'webfont':
                let formats = font.formats;
                let formatStr = '';

                formats.forEach((format, idx) => {
                    formatStr += `(
                        name: "${format.name}",
                        extension: "${format.extension}"
                    )`;
                    if (idx + 1 < formats.length) {
                        formatStr += ',';
                    }
                });
                masterStr += `(
                    type: "webfont",
                    name: "${font.name}",
                    formats: (${formatStr}),
                    weight: "${font.weight}",
                    style: "${font.style}"
                ),`;
                break;
            case 'import':
                masterStr += `(
                    type: "import",
                    name: "${font.name}",
                    url: "${font.url}"
                ),`;
                break;
        }
    });
    //Remove last comma, and surround with parens. Don't move this inside the loop, not
    //all fonts are generated and will break it.
    return `(${masterStr.slice(0, masterStr.length - 1)})`;
}

function importStyleOverrides(srcBase, entryFilename){
	//TODO: Nuke original overrides folder to regen ('clean', effectively).
	let dirs = pkg.directories;
	let dest = helpers.joinPathFromRoot(dirs.sassGeneratedRoot, dirs.sassOverridesBase);
	let destEntryPoint = path.join(dest, pkg.resources.sassOverridesEntryPoint);

	ncp(srcBase, dest, function(err) {
		if(err) {
			console.log("Copying style overrides file failed! You must specify a valid base dir with an entry point file for SASS overrides, even if it is empty, in your settings.json file. Aborting build.", err);
			process.exit();
			return;
		}
		console.log("Successfully copied SASS override resources.");

        fs.rename(path.join(dest, entryFilename), destEntryPoint, function (err) {
            if (err) {
                console.log("Could not rename SASS entry point. Aborting.", err);
                process.exit();
                return;
            }
            console.log("Successfully renamed SASS overrides entry point.");
        })
	});
}

/**
 * Gets a webfont plugin configuration object from the app settings for the Webfont webpack plugin
 *
 * @param cfg  {Object}     The current full runtime config object
 *
 * @returns {{}|null}
 */
function getWebfontPluginCfg(cfg) {
    let settings = cfg.appSettings;
    let fontList = settings.font;
    let fontDef = fontList && fontList.find(el => el.generated);

    if (!fontDef) {
        return null;
    }

    return {
        files: helpers.joinPathFromRoot(cfg.path.resrcRoot, settings.resources.fontRoot, fontDef.name, 'src', '*.svg'),
        fontName: fontDef.name,
        css: true,
        template: helpers.joinPathFromRoot('config', 'templates', 'font-template.scss.njk'),
        cssTemplateFontPath: urlJoin(cfg.path.contentRoot, cfg.appSettings.url.relative.font, fontDef.name),
        dest: {
            fontsDir: helpers.joinPathFromRoot(cfg.path.resrcRoot, settings.resources.fontRoot, fontDef.name),
            stylesDir: helpers.joinPathFromRoot(cfg.path.pkgJsonDirs.sassGeneratedRoot),
            outputFilename: `${fontDef.name}.scss`
        }
    };
}

module.exports = {
    getWebfontPluginCfg,
    parseFontConfigToSass
};