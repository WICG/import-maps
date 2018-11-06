'use strict';
const { expectSpecifierMap } = require('./helpers/parsing.js');
const { BUILT_IN_MODULE_PREFIX } = require('..');

describe('Relative URL-like specifiers', () => {
  it('should accept strings prefixed with ./, ../, or /', () => {
    expectSpecifierMap(
      `{
        "dotSlash": "./foo",
        "dotDotSlash": "../foo",
        "slash": "/foo"
      }`,
      {
        dotSlash: ['./foo'],
        dotDotSlash: ['../foo'],
        slash: ['/foo']
      }
    );
  });

  it('should accept the literal strings ./, ../, or / with no suffix', () => {
    expectSpecifierMap(
      `{
        "dotSlash": "./",
        "dotDotSlash": "../",
        "slash": "/"
      }`,
      {
        dotSlash: ['./'],
        dotDotSlash: ['../'],
        slash: ['/']
      }
    );
  });

  it('should ignore percent-encoded variants of ./, ../, or /', () => {
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
      {
        dotSlash1: [],
        dotDotSlash1: [],
        dotSlash2: [],
        dotDotSlash2: [],
        slash2: [],
        dotSlash3: [],
        dotDotSlash3: []
      }
    );
  });
});

describe('Built-in modules', () => {
  it('should accept strings prefixed with the built-in module prefix', () => {
    expectSpecifierMap(
      `{
        "foo": "${BUILT_IN_MODULE_PREFIX}foo"
      }`,
      {
        foo: [`${BUILT_IN_MODULE_PREFIX}foo`]
      }
    );
  });

  it('should ignore percent-encoded variants of the built-in module prefix', () => {
    expectSpecifierMap(
      `{
        "foo": "${encodeURIComponent(BUILT_IN_MODULE_PREFIX)}foo"
      }`,
      {
        foo: []
      }
    );
  });

  it('should ignore other unprefixed strings', () => {
    for (const bad of ['bar', '\\bar', '~bar', '#bar', '?bar']) {
      expectSpecifierMap(
        `{
          "foo": "${bad}"
        }`,
        {
          foo: []
        }
      );
    }
  });
});

describe('Absolute URLs', () => {
  it('should only accept absolute URL-string map targets with fetch schemes', () => {
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
      {
        about: ['about:good'],
        blob: ['blob:good'],
        data: ['data:good'],
        file: ['file:///good'],
        filesystem: ['filesystem:good'],
        http: ['http://good/'],
        https: ['https://good/'],
        ftp: ['ftp://good/'],
        import: [],
        mailto: [],
        javascript: [],
        wss: []
      }
    );
  });

  it('should only accept absolute URL-string map targets with fetch schemes inside arrays', () => {
    expectSpecifierMap(
      `{
        "about": ["./valid1", "about:good", "../valid2"],
        "blob": ["./valid1", "blob:good", "../valid2"],
        "data": ["./valid1", "data:good", "../valid2"],
        "file": ["./valid1", "file:///good", "../valid2"],
        "filesystem": ["./valid1", "filesystem:good", "../valid2"],
        "http": ["./valid1", "http://good/", "../valid2"],
        "https": ["./valid1", "https://good/", "../valid2"],
        "ftp": ["./valid1", "ftp://good/", "../valid2"],
        "import": ["./valid1", "import:bad", "../valid2"],
        "mailto": ["./valid1", "mailto:bad", "../valid2"],
        "javascript": ["./valid1", "javascript:bad", "../valid2"],
        "wss": ["./valid1", "wss:bad", "../valid2"]
      }`,
      {
        about: ['./valid1', 'about:good', '../valid2'],
        blob: ['./valid1', 'blob:good', '../valid2'],
        data: ['./valid1', 'data:good', '../valid2'],
        file: ['./valid1', 'file:///good', '../valid2'],
        filesystem: ['./valid1', 'filesystem:good', '../valid2'],
        http: ['./valid1', 'http://good/', '../valid2'],
        https: ['./valid1', 'https://good/', '../valid2'],
        ftp: ['./valid1', 'ftp://good/', '../valid2'],
        import: ['./valid1', '../valid2'],
        mailto: ['./valid1', '../valid2'],
        javascript: ['./valid1', '../valid2'],
        wss: ['./valid1', '../valid2']
      }
    );
  });

  it('should parse and serialize absolute URLs, ignoring unparseable ones', () => {
    expectSpecifierMap(
      `{
        "unparseable1": "https://ex ample.org/",
        "unparseable2": "https://example.com:demo",
        "unparseable3": "http://[www.example.com]/",
        "invalidButParseable1": "https:example.org",
        "invalidButParseable2": "https://///example.com///",
        "prettyNormal": "https://example.net",
        "percentDecoding": "https://ex%41mple.com/",
        "noPercentDecoding": "https://example.com/%41"
      }`,
      {
        unparseable1: [],
        unparseable2: [],
        unparseable3: [],
        invalidButParseable1: ['https://example.org/'],
        invalidButParseable2: ['https://example.com///'],
        prettyNormal: ['https://example.net/'],
        percentDecoding: ['https://example.com/'],
        noPercentDecoding: ['https://example.com/%41']
      }
    );
  });

  it('should parse and serialize absolute URLs, ignoring unparseable ones inside arrays', () => {
    expectSpecifierMap(
      `{
        "unparseable1": ["./valid1", "https://ex ample.org/", "../valid2"],
        "unparseable2": ["./valid1", "https://example.com:demo", "../valid2"],
        "unparseable3": ["./valid1", "http://[www.example.com]/", "../valid2"],
        "invalidButParseable1": ["./valid1", "https:example.org", "../valid2"],
        "invalidButParseable2": ["./valid1", "https://///example.com///", "../valid2"],
        "prettyNormal": ["./valid1", "https://example.net", "../valid2"],
        "percentDecoding": ["./valid1", "https://ex%41mple.com/", "../valid2"],
        "noPercentDecoding": ["./valid1", "https://example.com/%41", "../valid2"]
      }`,
      {
        unparseable1: ['./valid1', '../valid2'],
        unparseable2: ['./valid1', '../valid2'],
        unparseable3: ['./valid1', '../valid2'],
        invalidButParseable1: ['./valid1', 'https://example.org/', '../valid2'],
        invalidButParseable2: ['./valid1', 'https://example.com///', '../valid2'],
        prettyNormal: ['./valid1', 'https://example.net/', '../valid2'],
        percentDecoding: ['./valid1', 'https://example.com/', '../valid2'],
        noPercentDecoding: ['./valid1', 'https://example.com/%41', '../valid2']
      }
    );
  });
});
