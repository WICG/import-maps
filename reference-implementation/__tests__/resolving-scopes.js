'use strict';
const { URL } = require('url');
const { parseFromString } = require('../lib/parser.js');
const { resolve } = require('../lib/resolver.js');

const mapBaseURL = new URL('https://example.com/app/index.html');
const scriptURL = new URL('https://example.com/js/app.mjs');

function makeResolveUnderTest(mapString) {
  const map = parseFromString(mapString, mapBaseURL);
  return (specifier, baseURL = scriptURL) => resolve(specifier, map, baseURL);
}

describe('Mapped using scope instead of "imports"', () => {
  it('should fail when the mapping is to an empty array', () => {
    const resolveUnderTest = makeResolveUnderTest(`{
      "scopes": {
        "/js": {
          "moment": null,
          "lodash": []
        }
      }
    }`);

    expect(() => resolveUnderTest('moment')).toThrow(TypeError);
    expect(() => resolveUnderTest('lodash')).toThrow(TypeError);
  });

  describe('Package-like scenarios', () => {
    const resolveUnderTest = makeResolveUnderTest(`{
      "imports": {
        "moment": "/node_modules/moment/src/moment.js",
        "moment/": "/node_modules/moment/src/",
        "lodash-dot": "./node_modules/lodash-es/lodash.js",
        "lodash-dot/": "./node_modules/lodash-es/",
        "lodash-dotdot": "../node_modules/lodash-es/lodash.js",
        "lodash-dotdot/": "../node_modules/lodash-es/"
      },
      "scopes": {
        "/": {
          "moment": "/node_modules_3/moment/src/moment.js"
        },
        "/js": {
          "lodash-dot": "./node_modules_2/lodash-es/lodash.js",
          "lodash-dot/": "./node_modules_2/lodash-es/",
          "lodash-dotdot": "../node_modules_2/lodash-es/lodash.js",
          "lodash-dotdot/": "../node_modules_2/lodash-es/"
        }
      }
    }`);

    const subScriptURL = new URL('https://example.com/app.mjs');

    it('should resolve scoped and not cascade', () => {
      expect(resolveUnderTest('lodash-dot')).toMatchURL('https://example.com/app/node_modules_2/lodash-es/lodash.js');
      expect(resolveUnderTest('lodash-dotdot')).toMatchURL('https://example.com/node_modules_2/lodash-es/lodash.js');
      expect(resolveUnderTest('lodash-dot/foo')).toMatchURL('https://example.com/app/node_modules_2/lodash-es/foo');
      expect(resolveUnderTest('lodash-dotdot/foo')).toMatchURL('https://example.com/node_modules_2/lodash-es/foo');
    });

    it('should apply best scope match', () => {
      expect(resolveUnderTest('moment', subScriptURL)).toMatchURL('https://example.com/node_modules_3/moment/src/moment.js');
    });

    it('should fallback to imports', () => {
      expect(resolveUnderTest('moment/foo', subScriptURL)).toMatchURL('https://example.com/node_modules/moment/src/foo');
      expect(resolveUnderTest('lodash-dot', subScriptURL)).toMatchURL('https://example.com/app/node_modules/lodash-es/lodash.js');
      expect(resolveUnderTest('lodash-dotdot', subScriptURL)).toMatchURL('https://example.com/node_modules/lodash-es/lodash.js');
      expect(resolveUnderTest('lodash-dot/foo', subScriptURL)).toMatchURL('https://example.com/app/node_modules/lodash-es/foo');
      expect(resolveUnderTest('lodash-dotdot/foo', subScriptURL)).toMatchURL('https://example.com/node_modules/lodash-es/foo');
    });

    it('should still fail for package modules that are not declared', () => {
      expect(() => resolveUnderTest('underscore/')).toThrow(TypeError);
      expect(() => resolveUnderTest('underscore/foo')).toThrow(TypeError);
    });
  });
});

