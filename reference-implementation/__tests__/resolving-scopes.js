'use strict';
const { URL } = require('url');
const { parseFromString } = require('../lib/parser.js');
const { resolve } = require('../lib/resolver.js');

const mapBaseURL = new URL('https://example.com/app/index.html');

function makeResolveUnderTest(mapString) {
  const map = parseFromString(mapString, mapBaseURL);
  return (specifier, baseURL) => resolve(specifier, map, baseURL);
}

describe('Mapped using scope instead of "imports"', () => {
  const jsNonDirURL = new URL('https://example.com/js');
  const inJSDirURL = new URL('https://example.com/js/app.mjs');
  const topLevelURL = new URL('https://example.com/app.mjs');

  it('should fail when the mapping is to an empty array', () => {
    const resolveUnderTest = makeResolveUnderTest(`{
      "scopes": {
        "/js/": {
          "moment": null,
          "lodash": []
        }
      }
    }`);

    expect(() => resolveUnderTest('moment', inJSDirURL)).toThrow(TypeError);
    expect(() => resolveUnderTest('lodash', inJSDirURL)).toThrow(TypeError);
  });

  describe('Exact vs. prefix based matching', () => {
    it('should match correctly when both are in the map', () => {
      const resolveUnderTest = makeResolveUnderTest(`{
        "scopes": {
          "/js": {
            "moment": "/only-triggered-by-exact/moment",
            "moment/": "/only-triggered-by-exact/moment/"
          },
          "/js/": {
            "moment": "/triggered-by-any-subpath/moment",
            "moment/": "/triggered-by-any-subpath/moment/"
          }
        }
      }`);

      expect(resolveUnderTest('moment', jsNonDirURL)).toMatchURL('https://example.com/only-triggered-by-exact/moment');
      expect(resolveUnderTest('moment/foo', jsNonDirURL)).toMatchURL('https://example.com/only-triggered-by-exact/moment/foo');

      expect(resolveUnderTest('moment', inJSDirURL)).toMatchURL('https://example.com/triggered-by-any-subpath/moment');
      expect(resolveUnderTest('moment/foo', inJSDirURL)).toMatchURL('https://example.com/triggered-by-any-subpath/moment/foo');
    });

    it('should match correctly when only an exact match is in the map', () => {
      const resolveUnderTest = makeResolveUnderTest(`{
        "scopes": {
          "/js": {
            "moment": "/only-triggered-by-exact/moment",
            "moment/": "/only-triggered-by-exact/moment/"
          }
        }
      }`);

      expect(resolveUnderTest('moment', jsNonDirURL)).toMatchURL('https://example.com/only-triggered-by-exact/moment');
      expect(resolveUnderTest('moment/foo', jsNonDirURL)).toMatchURL('https://example.com/only-triggered-by-exact/moment/foo');

      expect(() => resolveUnderTest('moment', inJSDirURL)).toThrow(TypeError);
      expect(() => resolveUnderTest('moment/foo', inJSDirURL)).toThrow(TypeError);
    });

    it('should match correctly when only a prefix match is in the map', () => {
      const resolveUnderTest = makeResolveUnderTest(`{
        "scopes": {
          "/js/": {
            "moment": "/triggered-by-any-subpath/moment",
            "moment/": "/triggered-by-any-subpath/moment/"
          }
        }
      }`);

      expect(() => resolveUnderTest('moment', jsNonDirURL)).toThrow(TypeError);
      expect(() => resolveUnderTest('moment/foo', jsNonDirURL)).toThrow(TypeError);

      expect(resolveUnderTest('moment', inJSDirURL)).toMatchURL('https://example.com/triggered-by-any-subpath/moment');
      expect(resolveUnderTest('moment/foo', inJSDirURL)).toMatchURL('https://example.com/triggered-by-any-subpath/moment/foo');
    });
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
        "/js/": {
          "lodash-dot": "./node_modules_2/lodash-es/lodash.js",
          "lodash-dot/": "./node_modules_2/lodash-es/",
          "lodash-dotdot": "../node_modules_2/lodash-es/lodash.js",
          "lodash-dotdot/": "../node_modules_2/lodash-es/"
        }
      }
    }`);

    it('should resolve scoped and not cascade', () => {
      expect(resolveUnderTest('lodash-dot', inJSDirURL)).toMatchURL('https://example.com/app/node_modules_2/lodash-es/lodash.js');
      expect(resolveUnderTest('lodash-dotdot', inJSDirURL)).toMatchURL('https://example.com/node_modules_2/lodash-es/lodash.js');
      expect(resolveUnderTest('lodash-dot/foo', inJSDirURL)).toMatchURL('https://example.com/app/node_modules_2/lodash-es/foo');
      expect(resolveUnderTest('lodash-dotdot/foo', inJSDirURL)).toMatchURL('https://example.com/node_modules_2/lodash-es/foo');
    });

    it('should apply best scope match', () => {
      expect(resolveUnderTest('moment', topLevelURL)).toMatchURL('https://example.com/node_modules_3/moment/src/moment.js');
    });

    it('should fallback to imports', () => {
      expect(resolveUnderTest('moment/foo', topLevelURL)).toMatchURL('https://example.com/node_modules/moment/src/foo');
      expect(resolveUnderTest('lodash-dot', topLevelURL)).toMatchURL('https://example.com/app/node_modules/lodash-es/lodash.js');
      expect(resolveUnderTest('lodash-dotdot', topLevelURL)).toMatchURL('https://example.com/node_modules/lodash-es/lodash.js');
      expect(resolveUnderTest('lodash-dot/foo', topLevelURL)).toMatchURL('https://example.com/app/node_modules/lodash-es/foo');
      expect(resolveUnderTest('lodash-dotdot/foo', topLevelURL)).toMatchURL('https://example.com/node_modules/lodash-es/foo');
    });

    it('should still fail for package-like specifiers that are not declared', () => {
      expect(() => resolveUnderTest('underscore/', inJSDirURL)).toThrow(TypeError);
      expect(() => resolveUnderTest('underscore/foo', inJSDirURL)).toThrow(TypeError);
    });
  });
});

