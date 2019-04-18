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
  it('should remap built-in modules', () => {
    const resolveUnderTest = makeResolveUnderTest(`{
      "imports": {
        "${BLANK}": "./blank.mjs",
        "${NONE}": "./none.mjs"
      }
    }`);

    expect(resolveUnderTest(BLANK)).toMatchURL('https://example.com/app/blank.mjs');
    expect(resolveUnderTest(NONE)).toMatchURL('https://example.com/app/none.mjs');
  });

  it('should remap built-in modules with fallbacks', () => {
    const resolveUnderTest = makeResolveUnderTest(`{
      "imports": {
        "${BLANK}": ["${BLANK}", "./blank.mjs"],
        "${NONE}": ["${NONE}", "./none.mjs"]
      }
    }`);

    expect(resolveUnderTest(BLANK)).toMatchURL(BLANK);
    expect(resolveUnderTest(NONE)).toMatchURL('https://example.com/app/none.mjs');
  });
});

describe('Remapping to built-in modules', () => {
  const resolveUnderTest = makeResolveUnderTest(`{
    "imports": {
      "blank": "${BLANK}",
      "/blank": "${BLANK}",
      "none": "${NONE}",
      "/none": "${NONE}"
    }
  }`);

  it(`should remap to "${BLANK}"`, () => {
    expect(resolveUnderTest('blank')).toMatchURL(BLANK);
    expect(resolveUnderTest('/blank')).toMatchURL(BLANK);
  });

  it(`should remap to "${BLANK}" for URL-like specifiers`, () => {
    expect(resolveUnderTest('/blank')).toMatchURL(BLANK);
    expect(resolveUnderTest('https://example.com/blank')).toMatchURL(BLANK);
    expect(resolveUnderTest('https://///example.com/blank')).toMatchURL(BLANK);
  });

  it(`should fail when remapping to "${NONE}"`, () => {
    expect(() => resolveUnderTest('none')).toThrow(TypeError);
    expect(() => resolveUnderTest('/none')).toThrow(TypeError);
  });
});

describe('Fallbacks with built-in module addresses', () => {
  const resolveUnderTest = makeResolveUnderTest(`{
    "imports": {
      "blank": [
        "${BLANK}",
        "./blank-fallback.mjs"
      ],
      "none": [
        "${NONE}",
        "./none-fallback.mjs"
      ]
    }
  }`);

  it(`should resolve to "${BLANK}"`, () => {
    expect(resolveUnderTest('blank')).toMatchURL(BLANK);
  });

  it(`should fall back past "${NONE}"`, () => {
    expect(resolveUnderTest('none')).toMatchURL('https://example.com/app/none-fallback.mjs');
  });
});
