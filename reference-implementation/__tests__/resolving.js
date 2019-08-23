'use strict';
const { URL } = require('url');
const { parseFromString } = require('../lib/parser.js');
const { resolve } = require('../lib/resolver.js');
const { BUILT_IN_MODULE_SCHEME } = require('../lib/utils.js');
const { testWarningHandler } = require('./helpers/parsing.js');

const BLANK = `${BUILT_IN_MODULE_SCHEME}:blank`;
const NONE = `${BUILT_IN_MODULE_SCHEME}:none`;

const mapBaseURL = new URL('https://example.com/app/index.html');
const scriptURL = new URL('https://example.com/js/app.mjs');

function makeResolveUnderTest(mapString) {
  const map = parseFromString(mapString, mapBaseURL);
  return specifier => resolve(specifier, map, scriptURL);
}

describe('Unmapped', () => {
  const resolveUnderTest = makeResolveUnderTest(`{}`);

  it('should resolve ./ specifiers as URLs', () => {
    expect(resolveUnderTest('./foo')).toMatchURL('https://example.com/js/foo');
    expect(resolveUnderTest('./foo/bar')).toMatchURL('https://example.com/js/foo/bar');
    expect(resolveUnderTest('./foo/../bar')).toMatchURL('https://example.com/js/bar');
    expect(resolveUnderTest('./foo/../../bar')).toMatchURL('https://example.com/bar');
  });

  it('should resolve ../ specifiers as URLs', () => {
    expect(resolveUnderTest('../foo')).toMatchURL('https://example.com/foo');
    expect(resolveUnderTest('../foo/bar')).toMatchURL('https://example.com/foo/bar');
    expect(resolveUnderTest('../../../foo/bar')).toMatchURL('https://example.com/foo/bar');
  });

  it('should resolve / specifiers as URLs', () => {
    expect(resolveUnderTest('/foo')).toMatchURL('https://example.com/foo');
    expect(resolveUnderTest('/foo/bar')).toMatchURL('https://example.com/foo/bar');
    expect(resolveUnderTest('/../../foo/bar')).toMatchURL('https://example.com/foo/bar');
    expect(resolveUnderTest('/../foo/../bar')).toMatchURL('https://example.com/bar');
  });

  it('should parse absolute fetch-scheme URLs', () => {
    expect(resolveUnderTest('about:good')).toMatchURL('about:good');
    expect(resolveUnderTest('https://example.net')).toMatchURL('https://example.net/');
    expect(resolveUnderTest('https://ex%41mple.com/')).toMatchURL('https://example.com/');
    expect(resolveUnderTest('https:example.org')).toMatchURL('https://example.org/');
    expect(resolveUnderTest('https://///example.com///')).toMatchURL('https://example.com///');
  });

  it('should fail for strings not parseable as absolute URLs and not starting with ./ ../ or /', () => {
    expect(() => resolveUnderTest('foo')).toThrow(TypeError);
    expect(() => resolveUnderTest('\\foo')).toThrow(TypeError);
    expect(() => resolveUnderTest(':foo')).toThrow(TypeError);
    expect(() => resolveUnderTest('@foo')).toThrow(TypeError);
    expect(() => resolveUnderTest('%2E/foo')).toThrow(TypeError);
    expect(() => resolveUnderTest('%2E%2E/foo')).toThrow(TypeError);
    expect(() => resolveUnderTest('.%2Ffoo')).toThrow(TypeError);
    expect(() => resolveUnderTest('https://ex ample.org/')).toThrow(TypeError);
    expect(() => resolveUnderTest('https://example.com:demo')).toThrow(TypeError);
    expect(() => resolveUnderTest('http://[www.example.com]/')).toThrow(TypeError);
  });
});

describe('the empty string', () => {
  it('should fail for an unmapped empty string', () => {
    const resolveUnderTest = makeResolveUnderTest(`{}`);
    expect(() => resolveUnderTest('')).toThrow(TypeError);
  });

  it('should fail for a mapped empty string', () => {
    const assertWarnings = testWarningHandler([
      'Invalid empty string specifier.',
      'Invalid empty string specifier.',
      'Invalid empty string specifier.'
    ]);
    const resolveUnderTest = makeResolveUnderTest(`{
      "imports": {
        "": "/",
        "emptyString": "",
        "emptyString/": ""
      }
    }`);
    expect(() => resolveUnderTest('')).toThrow(TypeError);
    expect(() => resolveUnderTest('emptyString')).toThrow(TypeError);
    expect(() => resolveUnderTest('emptyString/a')).toThrow(TypeError);
    assertWarnings();
  });
});

describe('non-fetch-schemes', () => {
  it('should fail for absolute non-fetch-scheme URLs', () => {
    const resolveUnderTest = makeResolveUnderTest(`{}`);
    expect(() => resolveUnderTest('mailto:bad')).toThrow(TypeError);
    expect(() => resolveUnderTest('import:bad')).toThrow(TypeError);
    expect(() => resolveUnderTest('javascript:bad')).toThrow(TypeError);
    expect(() => resolveUnderTest('wss:bad')).toThrow(TypeError);
  });

  it('should allow remapping module specifiers that are non-fetch-scheme URLs', () => {
    const resolveUnderTest = makeResolveUnderTest(`{
      "imports": {
        "mailto:bad": "/",
        "import:bad": "/",
        "javascript:bad": "/",
        "wss:bad": "/"
      }
    }`);
    expect(resolveUnderTest('mailto:bad')).toMatchURL('https://example.com/');
    expect(resolveUnderTest('import:bad')).toMatchURL('https://example.com/');
    expect(resolveUnderTest('javascript:bad')).toMatchURL('https://example.com/');
    expect(resolveUnderTest('wss:bad')).toMatchURL('https://example.com/');
  });
});

describe('Mapped using the "imports" key only (no scopes)', () => {
  it('should fail when the mapping is to an empty array', () => {
    const resolveUnderTest = makeResolveUnderTest(`{
      "imports": {
        "moment": null,
        "lodash": []
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
        "lodash-dotdot/": "../node_modules/lodash-es/",
        "nowhere/": [],
        "not-a-url/": "a/"
      }
    }`);

    it('should work for package main modules', () => {
      expect(resolveUnderTest('moment')).toMatchURL('https://example.com/node_modules/moment/src/moment.js');
      expect(resolveUnderTest('lodash-dot')).toMatchURL('https://example.com/app/node_modules/lodash-es/lodash.js');
      expect(resolveUnderTest('lodash-dotdot')).toMatchURL('https://example.com/node_modules/lodash-es/lodash.js');
    });

    it('should work for package submodules', () => {
      expect(resolveUnderTest('moment/foo')).toMatchURL('https://example.com/node_modules/moment/src/foo');
      expect(resolveUnderTest('lodash-dot/foo')).toMatchURL('https://example.com/app/node_modules/lodash-es/foo');
      expect(resolveUnderTest('lodash-dotdot/foo')).toMatchURL('https://example.com/node_modules/lodash-es/foo');
    });

    it('should work for package names that end in a slash by just passing through', () => {
      // TODO: is this the right behavior, or should we throw?
      expect(resolveUnderTest('moment/')).toMatchURL('https://example.com/node_modules/moment/src/');
    });

    it('should still fail for package modules that are not declared', () => {
      expect(() => resolveUnderTest('underscore/')).toThrow(TypeError);
      expect(() => resolveUnderTest('underscore/foo')).toThrow(TypeError);
    });

    it('should fail for package submodules that map to nowhere', () => {
      expect(() => resolveUnderTest('nowhere/foo')).toThrow(TypeError);
    });

    it('should not allow breaking out of a package', () => {
      expect(resolveUnderTest(`moment/${BLANK}`)).toMatchURL(`https://example.com/node_modules/moment/src/${BLANK}`);
      expect(resolveUnderTest(`moment/${NONE}`)).toMatchURL(`https://example.com/node_modules/moment/src/${NONE}`);
      expect(resolveUnderTest('moment/https://example.org/')).toMatchURL('https://example.com/node_modules/moment/src/https://example.org/');
      expect(() => resolveUnderTest('nowhere/https://example.org/')).toThrow(TypeError);
      expect(resolveUnderTest('moment/http://[www.example.com]/')).toMatchURL('https://example.com/node_modules/moment/src/http://[www.example.com]/');
      expect(() => resolveUnderTest('not-a-url/a')).toThrow(TypeError);
    });
  });

  describe('Tricky specifiers', () => {
    const resolveUnderTest = makeResolveUnderTest(`{
      "imports": {
        "package/withslash": "/node_modules/package-with-slash/index.mjs",
        "not-a-package": "/lib/not-a-package.mjs",
        ".": "/lib/dot.mjs",
        "..": "/lib/dotdot.mjs",
        "..\\\\": "/lib/dotdotbackslash.mjs",
        "%2E": "/lib/percent2e.mjs",
        "%2F": "/lib/percent2f.mjs"
      }
    }`);

    it('should work for explicitly-mapped specifiers that happen to have a slash', () => {
      expect(resolveUnderTest('package/withslash')).toMatchURL('https://example.com/node_modules/package-with-slash/index.mjs');
    });

    it('should work when the specifier has punctuation', () => {
      expect(resolveUnderTest('.')).toMatchURL('https://example.com/lib/dot.mjs');
      expect(resolveUnderTest('..')).toMatchURL('https://example.com/lib/dotdot.mjs');
      expect(resolveUnderTest('..\\')).toMatchURL('https://example.com/lib/dotdotbackslash.mjs');
      expect(resolveUnderTest('%2E')).toMatchURL('https://example.com/lib/percent2e.mjs');
      expect(resolveUnderTest('%2F')).toMatchURL('https://example.com/lib/percent2f.mjs');
    });

    it('should fail for attempting to get a submodule of something not declared with a trailing slash', () => {
      expect(() => resolveUnderTest('not-a-package/foo')).toThrow(TypeError);
    });
  });

  describe('percent-encoding', () => {
    it('should not try to resolve percent-encoded path-based URLs (in keys)', () => {
      const resolveUnderTest = makeResolveUnderTest(`{
        "imports": {
          "%2E/": "/dotSlash1/",
          ".%2F": "/dotSlash2/",
          "%2E%2F": "/dotSlash3/",
          ".%2E/": "/dotDotSlash1/",
          "%2E./": "/dotDotSlash2/",
          "%2E%2E/": "/dotDotSlash3/",
          "%2E%2E%2F": "/dotDotSlash4/",
          "%2F": "/slash1/"
        }
      }`);
      expect(resolveUnderTest('/')).toMatchURL('https://example.com/');
      expect(resolveUnderTest('./')).toMatchURL('https://example.com/js/');
      expect(resolveUnderTest('../')).toMatchURL('https://example.com/');
      expect(resolveUnderTest('%2F')).toMatchURL('https://example.com/slash1/');
      expect(resolveUnderTest('%2E/')).toMatchURL('https://example.com/dotSlash1/');
      expect(resolveUnderTest('.%2F')).toMatchURL('https://example.com/dotSlash2/');
      expect(resolveUnderTest('%2E%2F')).toMatchURL('https://example.com/dotSlash3/');
      expect(resolveUnderTest('.%2E/')).toMatchURL('https://example.com/dotDotSlash1/');
      expect(resolveUnderTest('%2E./')).toMatchURL('https://example.com/dotDotSlash2/');
      expect(resolveUnderTest('%2E%2E/')).toMatchURL('https://example.com/dotDotSlash3/');
      expect(resolveUnderTest('%2E%2E%2F')).toMatchURL('https://example.com/dotDotSlash4/');
    });

    it('should not try to resolve percent-encoded path-based URLs (in values)', () => {
      const resolveUnderTest = makeResolveUnderTest(`{
        "imports": {
          "slash1": "%2F",
          "dotSlash1": "%2E/",
          "dotSlash2": ".%2F",
          "dotSlash3": "%2E%2F",
          "dotDotSlash1": ".%2E/",
          "dotDotSlash2": "%2E./",
          "dotDotSlash3": "%2E%2E/",
          "dotDotSlash4": "%2E%2E%2F"
        }
      }`);
      expect(() => resolveUnderTest('slash1')).toThrow(TypeError);
      expect(() => resolveUnderTest('dotSlash1')).toThrow(TypeError);
      expect(() => resolveUnderTest('dotSlash2')).toThrow(TypeError);
      expect(() => resolveUnderTest('dotSlash3')).toThrow(TypeError);
      expect(() => resolveUnderTest('dotDotSlash1')).toThrow(TypeError);
      expect(() => resolveUnderTest('dotDotSlash2')).toThrow(TypeError);
      expect(() => resolveUnderTest('dotDotSlash3')).toThrow(TypeError);
      expect(() => resolveUnderTest('dotDotSlash4')).toThrow(TypeError);
    });

    it('should not try to resolve percent-encoded built-in modules', () => {
      const resolveUnderTest = makeResolveUnderTest(`{
        "imports": {
          "blank": "${BLANK.replace(/:/g, '%3A')}"
        }
      }`);

      expect(() => resolveUnderTest('blank')).toThrow(TypeError);
      expect(resolveUnderTest(BLANK)).toMatchURL(BLANK);
      expect(() => resolveUnderTest(BLANK.replace(/:/g, '%3A'))).toThrow(TypeError);
    });
  });

  describe('URL-like specifiers', () => {
    const resolveUnderTest = makeResolveUnderTest(`{
      "imports": {
        "/lib/foo.mjs": "./more/bar.mjs",
        "./dotrelative/foo.mjs": "/lib/dot.mjs",
        "../dotdotrelative/foo.mjs": "/lib/dotdot.mjs",

        "/lib/no.mjs": null,
        "./dotrelative/no.mjs": [],

        "/": "/lib/slash-only/",
        "./": "/lib/dotslash-only/",

        "/test/": "/lib/url-trailing-slash/",
        "./test/": "/lib/url-trailing-slash-dot/",

        "/test": "/lib/test1.mjs",
        "../test": "/lib/test2.mjs"
      }
    }`);

    it('should remap to other URLs', () => {
      expect(resolveUnderTest('https://example.com/lib/foo.mjs')).toMatchURL('https://example.com/app/more/bar.mjs');
      expect(resolveUnderTest('https://///example.com/lib/foo.mjs')).toMatchURL('https://example.com/app/more/bar.mjs');
      expect(resolveUnderTest('/lib/foo.mjs')).toMatchURL('https://example.com/app/more/bar.mjs');

      expect(resolveUnderTest('https://example.com/app/dotrelative/foo.mjs')).toMatchURL('https://example.com/lib/dot.mjs');
      expect(resolveUnderTest('../app/dotrelative/foo.mjs')).toMatchURL('https://example.com/lib/dot.mjs');

      expect(resolveUnderTest('https://example.com/dotdotrelative/foo.mjs')).toMatchURL('https://example.com/lib/dotdot.mjs');
      expect(resolveUnderTest('../dotdotrelative/foo.mjs')).toMatchURL('https://example.com/lib/dotdot.mjs');
    });

    it('should fail for URLs that remap to empty arrays', () => {
      expect(() => resolveUnderTest('https://example.com/lib/no.mjs')).toThrow(TypeError);
      expect(() => resolveUnderTest('/lib/no.mjs')).toThrow(TypeError);
      expect(() => resolveUnderTest('../lib/no.mjs')).toThrow(TypeError);

      expect(() => resolveUnderTest('https://example.com/app/dotrelative/no.mjs')).toThrow(TypeError);
      expect(() => resolveUnderTest('/app/dotrelative/no.mjs')).toThrow(TypeError);
      expect(() => resolveUnderTest('../app/dotrelative/no.mjs')).toThrow(TypeError);
    });

    it('should remap URLs that are just composed from / and .', () => {
      expect(resolveUnderTest('https://example.com/')).toMatchURL('https://example.com/lib/slash-only/');
      expect(resolveUnderTest('/')).toMatchURL('https://example.com/lib/slash-only/');
      expect(resolveUnderTest('../')).toMatchURL('https://example.com/lib/slash-only/');

      expect(resolveUnderTest('https://example.com/app/')).toMatchURL('https://example.com/lib/dotslash-only/');
      expect(resolveUnderTest('/app/')).toMatchURL('https://example.com/lib/dotslash-only/');
      expect(resolveUnderTest('../app/')).toMatchURL('https://example.com/lib/dotslash-only/');
    });

    it('should remap URLs that are prefix-matched by keys with trailing slashes', () => {
      expect(resolveUnderTest('/test/foo.mjs')).toMatchURL('https://example.com/lib/url-trailing-slash/foo.mjs');
      expect(resolveUnderTest('https://example.com/app/test/foo.mjs')).toMatchURL('https://example.com/lib/url-trailing-slash-dot/foo.mjs');
    });

    it('should use the last entry\'s address when URL-like specifiers parse to the same absolute URL', () => {
      expect(resolveUnderTest('/test')).toMatchURL('https://example.com/lib/test2.mjs');
    });
  });

  describe('Overlapping entries with trailing slashes', () => {
    it('should favor the most-specific key (no empty arrays)', () => {
      const resolveUnderTest = makeResolveUnderTest(`{
        "imports": {
          "a": "/1",
          "a/": "/2/",
          "a/b": "/3",
          "a/b/": "/4/"
        }
      }`);

      expect(resolveUnderTest('a')).toMatchURL('https://example.com/1');
      expect(resolveUnderTest('a/')).toMatchURL('https://example.com/2/');
      expect(resolveUnderTest('a/b')).toMatchURL('https://example.com/3');
      expect(resolveUnderTest('a/b/')).toMatchURL('https://example.com/4/');
      expect(resolveUnderTest('a/b/c')).toMatchURL('https://example.com/4/c');
    });

    it('should favor the most-specific key when empty arrays are involved for less-specific keys', () => {
      const resolveUnderTest = makeResolveUnderTest(`{
        "imports": {
          "a": [],
          "a/": [],
          "a/b": "/3",
          "a/b/": "/4/"
        }
      }`);

      expect(() => resolveUnderTest('a')).toThrow(TypeError);
      expect(() => resolveUnderTest('a/')).toThrow(TypeError);
      expect(() => resolveUnderTest('a/x')).toThrow(TypeError);
      expect(resolveUnderTest('a/b')).toMatchURL('https://example.com/3');
      expect(resolveUnderTest('a/b/')).toMatchURL('https://example.com/4/');
      expect(resolveUnderTest('a/b/c')).toMatchURL('https://example.com/4/c');
      expect(() => resolveUnderTest('a/x/c')).toThrow(TypeError);
    });

    it('should favor the most-specific key when empty arrays are involved for more-specific keys', () => {
      const resolveUnderTest = makeResolveUnderTest(`{
        "imports": {
          "a": "/1",
          "a/": "/2/",
          "a/b": [],
          "a/b/": []
        }
      }`);

      expect(resolveUnderTest('a')).toMatchURL('https://example.com/1');
      expect(resolveUnderTest('a/')).toMatchURL('https://example.com/2/');
      expect(resolveUnderTest('a/x')).toMatchURL('https://example.com/2/x');
      expect(() => resolveUnderTest('a/b')).toThrow(TypeError);
      expect(() => resolveUnderTest('a/b/')).toThrow(TypeError);
      expect(() => resolveUnderTest('a/b/c')).toThrow(TypeError);
      expect(resolveUnderTest('a/x/c')).toMatchURL('https://example.com/2/x/c');
    });
  });
});
