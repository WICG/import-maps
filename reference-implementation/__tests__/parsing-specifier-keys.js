'use strict';
const { expectSpecifierMap } = require('./helpers/parsing.js');
const { BUILT_IN_MODULE_SCHEME } = require('../lib/utils.js');

const baseURL = new URL('https://base.example/path1/path2/path3');
const BLANK = `${BUILT_IN_MODULE_SCHEME}:blank`;

describe('Relative URL-like specifier keys', () => {
  it('should absolutize strings prefixed with ./, ../, or / into the corresponding URLs', () => {
    expectSpecifierMap(
      `{
        "./foo": "/dotslash",
        "../foo": "/dotdotslash",
        "/foo": "/slash"
      }`,
      baseURL,
      {
        'https://base.example/path1/path2/foo': ['https://base.example/dotslash'],
        'https://base.example/path1/foo': ['https://base.example/dotdotslash'],
        'https://base.example/foo': ['https://base.example/slash']
      }
    );
  });

  it('should not absolutize strings prefixed with ./, ../, or / with a data: URL base', () => {
    expectSpecifierMap(
      `{
        "./foo": "https://example.com/dotslash",
        "../foo": "https://example.com/dotdotslash",
        "/foo": "https://example.com/slash"
      }`,
      new URL('data:text/html,test'),
      {},
      [
        'Path-based module specifier "./foo" cannot be parsed against the base URL "data:text/html,test".',
        'Path-based module specifier "../foo" cannot be parsed against the base URL "data:text/html,test".',
        'Path-based module specifier "/foo" cannot be parsed against the base URL "data:text/html,test".'
      ]
    );
  });

  it('should absolutize the literal strings ./, ../, or / with no suffix', () => {
    expectSpecifierMap(
      `{
        "./": "/dotslash/",
        "../": "/dotdotslash/",
        "/": "/slash/"
      }`,
      baseURL,
      {
        'https://base.example/path1/path2/': ['https://base.example/dotslash/'],
        'https://base.example/path1/': ['https://base.example/dotdotslash/'],
        'https://base.example/': ['https://base.example/slash/']
      }
    );
  });

  it('should treat percent-encoded variants of ./, ../, or / as bare specifiers', () => {
    expectSpecifierMap(
      `{
        "%2E/": "/dotSlash1/",
        "%2E%2E/": "/dotDotSlash1/",
        ".%2F": "/dotSlash2",
        "..%2F": "/dotDotSlash2",
        "%2F": "/slash2",
        "%2E%2F": "/dotSlash3",
        "%2E%2E%2F": "/dotDotSlash3"
      }`,
      baseURL,
      {
        '%2E/': ['https://base.example/dotSlash1/'],
        '%2E%2E/': ['https://base.example/dotDotSlash1/'],
        '.%2F': ['https://base.example/dotSlash2'],
        '..%2F': ['https://base.example/dotDotSlash2'],
        '%2F': ['https://base.example/slash2'],
        '%2E%2F': ['https://base.example/dotSlash3'],
        '%2E%2E%2F': ['https://base.example/dotDotSlash3']
      }
    );
  });
});

describe('Absolute URL specifier keys', () => {
  it('should only accept absolute URL specifier keys with fetch schemes, treating others as bare specifiers', () => {
    expectSpecifierMap(
      `{
        "about:good": "/about",
        "blob:good": "/blob",
        "data:good": "/data",
        "file:///good": "/file",
        "filesystem:good": "/filesystem",
        "http://good/": "/http/",
        "https://good/": "/https/",
        "ftp://good/": "/ftp/",
        "import:bad": "/import",
        "mailto:bad": "/mailto",
        "javascript:bad": "/javascript",
        "wss:bad": "/wss"
      }`,
      baseURL,
      {
        'about:good': ['https://base.example/about'],
        'blob:good': ['https://base.example/blob'],
        'data:good': ['https://base.example/data'],
        'file:///good': ['https://base.example/file'],
        'filesystem:good': ['https://base.example/filesystem'],
        'http://good/': ['https://base.example/http/'],
        'https://good/': ['https://base.example/https/'],
        'ftp://good/': ['https://base.example/ftp/'],
        'import:bad': ['https://base.example/import'],
        'mailto:bad': ['https://base.example/mailto'],
        'javascript:bad': ['https://base.example/javascript'],
        'wss:bad': ['https://base.example/wss']
      }
    );
  });

  it('should parse absolute URLs, treating unparseable ones as bare specifiers', () => {
    expectSpecifierMap(
      `{
        "https://ex ample.org/": "/unparseable1/",
        "https://example.com:demo": "/unparseable2",
        "http://[www.example.com]/": "/unparseable3/",
        "https:example.org": "/invalidButParseable1/",
        "https://///example.com///": "/invalidButParseable2/",
        "https://example.net": "/prettyNormal/",
        "https://ex%41mple.com/": "/percentDecoding/",
        "https://example.com/%41": "/noPercentDecoding"
      }`,
      baseURL,
      {
        'https://ex ample.org/': ['https://base.example/unparseable1/'],
        'https://example.com:demo': ['https://base.example/unparseable2'],
        'http://[www.example.com]/': ['https://base.example/unparseable3/'],
        'https://example.org/': ['https://base.example/invalidButParseable1/'],
        'https://example.com///': ['https://base.example/invalidButParseable2/'],
        'https://example.net/': ['https://base.example/prettyNormal/'],
        'https://example.com/': ['https://base.example/percentDecoding/'],
        'https://example.com/%41': ['https://base.example/noPercentDecoding']
      }
    );
  });

  it('should parse built-in module specifier keys, including with a "/"', () => {
    expectSpecifierMap(
      `{
        "${BLANK}": "/blank",
        "${BLANK}/": "/blank/",
        "${BLANK}/foo": "/blank/foo",
        "${BLANK}\\\\foo": "/blank/backslashfoo"
      }`,
      baseURL,
      {
        [BLANK]: ['https://base.example/blank'],
        [`${BLANK}/`]: ['https://base.example/blank/'],
        [`${BLANK}/foo`]: ['https://base.example/blank/foo'],
        [`${BLANK}\\foo`]: ['https://base.example/blank/backslashfoo']
      }
    );
  });
});
