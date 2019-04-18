'use strict';
const { URL } = require('url');
const { parseFromString } = require('../lib/parser.js');
const { resolve } = require('../lib/resolver.js');
const { BUILT_IN_MODULE_SCHEME } = require('../lib/utils.js');

const mapBaseURL = new URL('https://example.com/app/index.html');
const scriptURL = new URL('https://example.com/js/app.mjs');

const BLANK = `${BUILT_IN_MODULE_SCHEME}:blank`;
const NONE = `${BUILT_IN_MODULE_SCHEME}:none`;

function makeResolveUnderTest(mapString) {
  const map = parseFromString(mapString, mapBaseURL);
  return specifier => resolve(specifier, map, scriptURL);
}

describe('Unmapped built-in module specifiers', () => {
  const resolveUnderTest = makeResolveUnderTest(`{}`);

  it(`should resolve "${BLANK}" to "${BLANK}"`, () => {
    expect(resolveUnderTest(BLANK)).toMatchURL(BLANK);
  });

  it(`should error resolving "${NONE}"`, () => {
    expect(() => resolveUnderTest(NONE)).toThrow(TypeError);
  });
});

describe('Remapping built-in module specifiers', () => {
  const resolveUnderTest = makeResolveUnderTest(`{
    "imports": {
      "${BLANK}": "./blank.mjs",
      "${BLANK}/": "./blank/",
      "${NONE}": "./none.mjs",
      "${NONE}/": "./none/"
    }
  }`);

  it('should remap individual built-in modules', () => {
    expect(resolveUnderTest(BLANK)).toMatchURL('https://example.com/app/blank.mjs');
    expect(resolveUnderTest(NONE)).toMatchURL('https://example.com/app/none.mjs');
  });

  it('should remap built-in module packages', () => {
    expect(resolveUnderTest(`${BLANK}/foo`)).toMatchURL('https://example.com/app/blank/foo');
    expect(resolveUnderTest(`${NONE}/foo`)).toMatchURL('https://example.com/app/none/foo');
  });
});

describe('Remapping built-in module specifiers with fallbacks', () => {
  const resolveUnderTest = makeResolveUnderTest(`{
    "imports": {
      "${BLANK}": ["${BLANK}", "./blank.mjs"],
      "${BLANK}/": ["${BLANK}/", "./blank/"],
      "${NONE}": ["${NONE}", "./none.mjs"],
      "${NONE}/": ["${NONE}/", "./none/"]
    }
  }`);

  it('should remap individual built-in modules', () => {
    expect(resolveUnderTest(BLANK)).toMatchURL(BLANK);
    expect(resolveUnderTest(NONE)).toMatchURL('https://example.com/app/none.mjs');
  });

  it('should remap built-in module packages', () => {
    expect(resolveUnderTest(`${BLANK}/foo`)).toMatchURL(`${BLANK}/foo`);
    expect(resolveUnderTest(`${NONE}/foo`)).toMatchURL('https://example.com/app/none/foo');
  });
});

describe('Fallbacks with built-in module addresses', () => {
  const resolveUnderTest = makeResolveUnderTest(`{
    "imports": {
      "blank": [
        "${BLANK}",
        "./blank-fallback.mjs"
      ],
      "blank/": [
        "${BLANK}/",
        "./blank-fallback/"
      ],
      "none": [
        "${NONE}",
        "./none-fallback.mjs"
      ],
      "none/": [
        "${NONE}/",
        "./none-fallback/"
      ],
      "blank-sub": [
        "${BLANK}/sub",
        "./blank-sub.mjs"
      ]
    }
  }`);

  it(`should resolve to "${BLANK}"`, () => {
    expect(resolveUnderTest('blank')).toMatchURL(BLANK);
  });

  it(`should resolve to "${BLANK}" as a package`, () => {
    // TODO is this correct? Seems incongruous with the blank-sub test case.
    expect(resolveUnderTest('blank/foo')).toMatchURL(`${BLANK}/foo`);
  });

  it(`should fall back past "${NONE}"`, () => {
    expect(resolveUnderTest('none')).toMatchURL('https://example.com/app/none-fallback.mjs');
  });

  it(`should fall back past "${NONE}" as a package`, () => {
    expect(resolveUnderTest('none/foo')).toMatchURL('https://example.com/app/none-fallback/foo');
  });

  it(`should fall back past "${BLANK}" submodules`, () => {
    expect(resolveUnderTest('blank-sub')).toMatchURL('https://example.com/app/blank-sub.mjs');
  });
});
