const postcss = require('postcss');
const merge = require('merge-options');
const { Compiler, Sprite, StackSprite } = require('svg-baker');
const { parse: parseQuery, stringify: stringifyQuery } = require('query-string');
const anymatch = require('anymatch');

const { name: packageName } = require('../package.json');
const FORMAT = require('../format');

const collectDeclarations = require('./collect-declarations-to-process');
const transforms = require('./transformations');

/**
 * @typedef {Object} PluginConfig
 * @extends {CompilerConfig}
 * @property {RegExp|string|Array<RegExp|string>} match
 * @property {string} format 'plain' | 'full'
 * @property {boolean} aspectRatio=true
 * @property {Sprite} sprite
 */
const defaultConfig = {
  match: /\.svg($|\?.*$)/,
  format: FORMAT.PLAIN,
  aspectRatio: true,
  sprite: undefined
};

module.exports = postcss.plugin(packageName, (opts = {}) => {
  const { ctx, ...restOpts } = opts;
  const {
    match,
    format,
    aspectRatio,
    sprite: userSprite,
    ...compilerOpts
  } = merge(defaultConfig, restOpts);

  const compiler = !userSprite ? new Compiler(compilerOpts) : null;
  const fileMatcher = path => anymatch(match, path);
  const isWebpack = !!(ctx && ctx.webpack);

  return async function plugin(root, result) {
    const declsAndPaths = await collectDeclarations(root, fileMatcher);
    let sprite;

    if (userSprite) {
      sprite = userSprite;
    } else {
      const files = declsAndPaths.map(item => `${item.absolute}${item.query || ''}`);
      await compiler.addFiles(files);
      sprite = await compiler.compile();
    }

    if (sprite.symbols.length === 0) {
      return;
    }

    const spriteFilename = sprite.config.filename;

    declsAndPaths.forEach(item => {
      const { decl, path, absolute, query } = item;
      const rule = decl.parent;
      const symbol = sprite.symbols.find(({ image }) => {
        return image.path === absolute && image.query === query;
      });

      if (!symbol) {
        return;
      }

      const position = sprite.calculateSymbolPosition(symbol, 'percent');
      const parsedQuery = parseQuery(query || '');
      let spriteUrl;

      if (sprite instanceof StackSprite) {
        spriteUrl = `${spriteFilename}#${symbol.id}`;
        transforms.stackSpriteSymbol(decl, spriteUrl);
      } else if (sprite instanceof Sprite) {
        // In webpack environment plugin produce `original_url?sprite_filename.svg`, and special loader
        // in pitching phase replace original url with sprite file name
        const q = stringifyQuery({ ...parsedQuery, spriteFilename });
        spriteUrl = isWebpack ? `${path}?${q}` : spriteFilename;

        transforms.spriteSymbol({
          decl,
          position,
          spriteUrl,
          format
        });
      }

      if (aspectRatio) {
        transforms.aspectRatio(rule, position.aspectRatio);
      }
    });

    return sprite.render().then(content => {
      result.messages.push({
        type: 'asset',
        kind: 'sprite',
        plugin: packageName,
        file: spriteFilename,
        content,
        sprite
      });

      if (isWebpack) {
        ctx.webpack._compilation.assets[spriteFilename] = {
          source() {
            return content;
          },
          size() {
            return content.length;
          }
        };
      }
    });
  };
});

module.exports.FORMAT = FORMAT;
