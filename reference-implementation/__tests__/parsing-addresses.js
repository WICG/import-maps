'use strict';
const { expectSpecifierMap } = require('./helpers/parsing.js');
const { BUILT_IN_MODULE_SCHEME } = require('../lib/utils.js');

const baseURL = new URL('https://base.example/path1/path2/path3');

describe('Relative URL-like addresses', () => {
  it('should accept strings prefixed with ./, ../, or /', () => {
    expectSpecifierMap(
      `{
        "dotSlash": "./foo",
        "dotDotSlash": "../foo",
        "slash": "/foo"
      }`,
      baseURL,
      {
        dotSlash: ['https://base.example/path1/path2/foo'],
        dotDotSlash: ['https://base.example/path1/foo'],
        slash: ['https://base.example/foo']
      }
    );
  });

  it('should not accept strings prefixed with ./, ../, or / for data: base URLs', () => {
    expectSpecifierMap(
      `{
        "dotSlash": "./foo",
        "dotDotSlash": "../foo",
        "slash": "/foo"
      }`,
      new URL('data:text/html,test'),
      {
        dotSlash: [],
        dotDotSlash: [],
        slash: []
      },
      [
        `Path-based module specifier "./foo" cannot be parsed against the base URL "data:text/html,test".`,
        `Path-based module specifier "../foo" cannot be parsed against the base URL "data:text/html,test".`,
        `Path-based module specifier "/foo" cannot be parsed against the base URL "data:text/html,test".`
      ]
    );
  });

  it('should accept the literal strings ./, ../, or / with no suffix', () => {
    expectSpecifierMap(
      `{
        "dotSlash": "./",
        "dotDotSlash": "../",
        "slash": "/"
      }`,
      baseURL,
      {
        dotSlash: ['https://base.example/path1/path2/'],
        dotDotSlash: ['https://base.example/path1/'],
        slash: ['https://base.example/']
      }
    );
  });

  it('should treat percent-encoded variants of ./, ../, or / as non-URLs', () => {
    expectSpecifierMap(
      `{
        "dotSlash1": "%2E/",
        "dotDotSlash1": "%2E%2E/",
        "dotSlash2": ".%2F",
        "dotDotSlash2": "..%2F",
        "slash2": "%2F",
        "dotSlash3": "%2E%2F",
        "dotDotSlash3": "%2E%2E%2F"
      }`,
      baseURL,
      {
        dotSlash1: ['%2E/'],
        dotDotSlash1: ['%2E%2E/'],
        dotSlash2: ['.%2F'],
        dotDotSlash2: ['..%2F'],
        slash2: ['%2F'],
        dotSlash3: ['%2E%2F'],
        dotDotSlash3: ['%2E%2E%2F']
      },
      []
    );
  });
});

describe('Built-in module addresses', () => {
  it('should accept URLs using the built-in module scheme', () => {
    expectSpecifierMap(
      `{
        "foo": "${BUILT_IN_MODULE_SCHEME}:foo"
      }`,
      baseURL,
      {
        foo: [`${BUILT_IN_MODULE_SCHEME}:foo`]
      }
    );
  });

  it('should treat percent-encoded variants of the built-in module scheme as non-URLs', () => {
    expectSpecifierMap(
      `{
        "foo": "${encodeURIComponent(BUILT_IN_MODULE_SCHEME + ':')}foo"
      }`,
      baseURL,
      {
        foo: [`${encodeURIComponent(BUILT_IN_MODULE_SCHEME + ':')}foo`]
      },
      []
    );
  });

  it('should allow built-in module URLs that contain "/" or "\\"', () => {
    expectSpecifierMap(
      `{
        "slashEnd": "${BUILT_IN_MODULE_SCHEME}:foo/",
        "slashMiddle": "${BUILT_IN_MODULE_SCHEME}:foo/bar",
        "backslash": "${BUILT_IN_MODULE_SCHEME}:foo\\\\baz"
      }`,
      baseURL,
      {
        slashEnd: [`${BUILT_IN_MODULE_SCHEME}:foo/`],
        slashMiddle: [`${BUILT_IN_MODULE_SCHEME}:foo/bar`],
        backslash: [`${BUILT_IN_MODULE_SCHEME}:foo\\baz`]
      }
    );
  });
});

describe('Absolute URL addresses', () => {
  it('should only accept absolute URL addresses with fetch schemes', () => {
    expectSpecifierMap(
      `{
        "about": "about:good",
        "blob": "blob:good",
        "data": "data:good",
        "file": "file:///good",
        "filesystem": "filesystem:good",
        "http": "http://good/",
        "https": "https://good/",
        "ftp": "ftp://good/",
        "import": "import:bad",
        "mailto": "mailto:bad",
        "javascript": "javascript:bad",
        "wss": "wss:bad"
      }`,
      baseURL,
      {
        about: ['about:good'],
        blob: ['blob:good'],
        data: ['data:good'],
        file: ['file:///good'],
        filesystem: ['filesystem:good'],
        http: ['http://good/'],
        https: ['https://good/'],
        ftp: ['ftp://good/'],
        import: ['import:bad'],
        mailto: ['mailto:bad'],
        javascript: ['javascript:bad'],
        wss: ['wss:bad']
      },
      []
    );
  });

  it('should only accept absolute URL addresses with fetch schemes inside arrays', () => {
    expectSpecifierMap(
      `{
        "about": ["about:good"],
        "blob": ["blob:good"],
        "data": ["data:good"],
        "file": ["file:///good"],
        "filesystem": ["filesystem:good"],
        "http": ["http://good/"],
        "https": ["https://good/"],
        "ftp": ["ftp://good/"],
        "import": ["import:bad"],
        "mailto": ["mailto:bad"],
        "javascript": ["javascript:bad"],
        "wss": ["wss:bad"]
      }`,
      baseURL,
      {
        about: ['about:good'],
        blob: ['blob:good'],
        data: ['data:good'],
        file: ['file:///good'],
        filesystem: ['filesystem:good'],
        http: ['http://good/'],
        https: ['https://good/'],
        ftp: ['ftp://good/'],
        import: ['import:bad'],
        mailto: ['mailto:bad'],
        javascript: ['javascript:bad'],
        wss: ['wss:bad']
      },
      []
    );
  });

  it('should parse/normalize absolute URLs, and treat unparseable ones as non-URLs', () => {
    expectSpecifierMap(
      `{
        "unparseable1": "https://ex ample.org/",
        "unparseable2": "https://example.com:demo",
        "unparseable3": "http://[www.example.com]/",
        "unparseable4": "-https://測試.com/測試",
        "unparseable5": "-HTTPS://example.com",
        "invalidButParseable1": "https:example.org",
        "invalidButParseable2": "https://///example.com///",
        "prettyNormal": "https://example.net",
        "percentDecoding": "https://ex%41mple.com/",
        "noPercentDecoding": "https://example.com/%41",
        "nonAscii": "https://測試.com/測試",
        "uppercase": "HTTPS://example.com"
      }`,
      baseURL,
      {
        unparseable1: ['https://ex ample.org/'],
        unparseable2: ['https://example.com:demo'],
        unparseable3: ['http://[www.example.com]/'],
        unparseable4: ['-https://測試.com/測試'],
        unparseable5: ['-HTTPS://example.com'],
        invalidButParseable1: ['https://example.org/'],
        invalidButParseable2: ['https://example.com///'],
        prettyNormal: ['https://example.net/'],
        percentDecoding: ['https://example.com/'],
        noPercentDecoding: ['https://example.com/%41'],
        nonAscii: ['https://xn--g6w251d.com/%E6%B8%AC%E8%A9%A6'],
        uppercase: ['https://example.com/']
      },
      []
    );
  });

  it('should parse absolute URLs, ignoring unparseable ones inside arrays', () => {
    expectSpecifierMap(
      `{
        "unparseable1": ["https://ex ample.org/"],
        "unparseable2": ["https://example.com:demo"],
        "unparseable3": ["http://[www.example.com]/"],
        "invalidButParseable1": ["https:example.org"],
        "invalidButParseable2": ["https://///example.com///"],
        "prettyNormal": ["https://example.net"],
        "percentDecoding": ["https://ex%41mple.com/"],
        "noPercentDecoding": ["https://example.com/%41"]
      }`,
      baseURL,
      {
        unparseable1: ['https://ex ample.org/'],
        unparseable2: ['https://example.com:demo'],
        unparseable3: ['http://[www.example.com]/'],
        invalidButParseable1: ['https://example.org/'],
        invalidButParseable2: ['https://example.com///'],
        prettyNormal: ['https://example.net/'],
        percentDecoding: ['https://example.com/'],
        noPercentDecoding: ['https://example.com/%41']
      },
      []
    );
  });
});

describe('Failing addresses: mismatched trailing slashes', () => {
  it('should warn for the simple case', () => {
    expectSpecifierMap(
      `{
        "trailer/": "/notrailer",
        "${BUILT_IN_MODULE_SCHEME}:trailer/": "/bim-notrailer"
      }`,
      baseURL,
      {
        'trailer/': [],
        [`${BUILT_IN_MODULE_SCHEME}:trailer/`]: []
      },
      [
        `Invalid address "https://base.example/notrailer" for package specifier key "trailer/". Package addresses must end with "/".`,
        `Invalid address "https://base.example/bim-notrailer" for package specifier key "${BUILT_IN_MODULE_SCHEME}:trailer/". Package addresses must end with "/".`
      ]
    );
  });

  it('should warn for a mismatch alone in an array', () => {
    expectSpecifierMap(
      `{
        "trailer/": ["/notrailer"],
        "${BUILT_IN_MODULE_SCHEME}:trailer/": ["/bim-notrailer"]
      }`,
      baseURL,
      {
        'trailer/': [],
        [`${BUILT_IN_MODULE_SCHEME}:trailer/`]: []
      },
      [
        `Invalid address "https://base.example/notrailer" for package specifier key "trailer/". Package addresses must end with "/".`,
        `Invalid address "https://base.example/bim-notrailer" for package specifier key "${BUILT_IN_MODULE_SCHEME}:trailer/". Package addresses must end with "/".`
      ]
    );
  });

  it('should warn for a mismatch alongside non-mismatches in an array', () => {
    expectSpecifierMap(
      `{
        "trailer/": ["/atrailer/", "/notrailer"],
        "${BUILT_IN_MODULE_SCHEME}:trailer/": ["/bim-atrailer/", "/bim-notrailer"]
      }`,
      baseURL,
      {
        'trailer/': ['https://base.example/atrailer/'],
        [`${BUILT_IN_MODULE_SCHEME}:trailer/`]: ['https://base.example/bim-atrailer/']
      },
      [
        `Invalid address "https://base.example/notrailer" for package specifier key "trailer/". Package addresses must end with "/".`,
        `Invalid address "https://base.example/bim-notrailer" for package specifier key "${BUILT_IN_MODULE_SCHEME}:trailer/". Package addresses must end with "/".`
      ]
    );
  });
});

describe('Other invalid addresses', () => {
  it('should treat unprefixed strings that are not absolute URLs as non-URLs', () => {
    for (const nonURL of ['bar', '\\bar', '~bar', '#bar', '?bar']) {
      expectSpecifierMap(
        `{
          "foo": ${JSON.stringify(nonURL)}
        }`,
        baseURL,
        {
          foo: [nonURL]
        },
        []
      );
    }
  });
});
