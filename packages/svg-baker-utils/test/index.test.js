const { parse } = require('postcss');

const {
  findBgImageDecls,
  resolveFile,
  ResolveError
} = require('..');

describe('findBgImageDecls', () => {
  const t = (input, expectedCount) => {
    const res = findBgImageDecls(parse(input));
    if (expectedCount) {
      res.length.should.eql(expectedCount);
    }
    return res;
  };

  it('should work!', () => {
    t('.a {color: red; background: red}', 0);
    t('.a {color: red; background-image: red}', 0);
    t('.a {color: red; background: url(qwe)}', 1);
    t('.a {color: red; background-image: url(qwe)}', 1);
    t('.a {color: red; background: url(qwe); background: red; background-image: url(qwe);}', 2);
  });
});

describe('resolveFile', () => {
  it('should work!', async () => {
    await expect(resolveFile('index.test.js', __dirname)).resolves.toBeString();
    await expect(resolveFile('index.test.js?qwe', __dirname)).resolves.toBeString();
    await expect(resolveFile('./index.test.js', __dirname)).resolves.toBeString();
    await expect(resolveFile('./index.test.js?qwe', __dirname)).resolves.toBeString();
    await expect(resolveFile('~postcss')).resolves.toBeString();
    await expect(resolveFile('qwe')).rejects.toBeInstanceOf(ResolveError);
    await expect(resolveFile('~qwe')).rejects.toBeInstanceOf(ResolveError);
  });
});