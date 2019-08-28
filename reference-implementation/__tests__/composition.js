'use strict';
const { URL } = require('url');
const { parseFromString } = require('../lib/parser.js');
const { concatMaps } = require('../lib/composer.js');
const { BUILT_IN_MODULE_SCHEME } = require('../lib/utils.js');
const { testWarningHandler } = require('./helpers/parsing.js');

const mapBaseURL = new URL('https://example.com/app/index.html');

// a convenience function for folding composition over a list of maps
function composeMaps(mapLikes, baseURL = mapBaseURL) {
  if (!Array.isArray(mapLikes) || mapLikes.length < 1) {
    throw new Error('composeMaps must be given a non-empty array of mapLikes');
  }
  let map = parseFromString(mapLikes.shift(), baseURL);
  for (const mapLike of mapLikes) {
    const newMap = parseFromString(mapLike, baseURL);
    map = concatMaps(map, newMap);
  }
  return map;
}

describe('Composition', () => {
  it('should compose with the empty map on the left', () => {
    const map = parseFromString(`{
      "imports": { "https://a/": ["https://b/"] },
      "scopes": {
        "https://c/": { "https://d/": ["https://e/"] }
      }
    }`, mapBaseURL);

    const resultMap = concatMaps(parseFromString('{}', mapBaseURL), map);

    expect(resultMap).toStrictEqual(map);
  });

  it('should compose with the empty map on the right', () => {
    const map = parseFromString(`{
      "imports": { "https://a/": ["https://b/"] },
      "scopes": {
        "https://c/": { "https://d/": ["https://e/"] }
      }
    }`, mapBaseURL);

    const resultMap = concatMaps(map, parseFromString('{}', mapBaseURL));

    expect(resultMap).toStrictEqual(map);
  });

  it('should compose maps that do not interact in any way', () => {
    expect(composeMaps([
      `{
        "imports": { "https://a/": "https://b/" }
      }`,
      `{
        "imports": { "https://c/": "https://d/" }
      }`,
      `{
        "imports": { "https://e/": "https://f/" }
      }`
    ])).toStrictEqual({
      imports: {
        'https://a/': ['https://b/'],
        'https://c/': ['https://d/'],
        'https://e/': ['https://f/']
      },
      scopes: {}
    });
  });

  it('should compose maps that interact via cascading', () => {
    expect(composeMaps([
      `{
        "imports": { "https://c/": "https://d/" }
      }`,
      `{
        "imports": { "https://b/": "https://c/" }
      }`,
      `{
        "imports": { "https://a/": "https://b/" }
      }`
    ])).toStrictEqual({
      imports: {
        'https://a/': ['https://d/'],
        'https://b/': ['https://d/'],
        'https://c/': ['https://d/']
      },
      scopes: {}
    });
  });

  it('should compose maps with fallbacks that interact via cascading', () => {
    expect(composeMaps([
      `{
        "imports": { "https://e/": ["https://g/", "https://h/"] }
      }`,
      `{
        "imports": {
          "https://c/": ["https://f/"],
          "https://b/": ["https://d/", "https://e/"]
        }
      }`,
      `{
        "imports": { "https://a/": ["https://b/", "https://c/"] }
      }`
    ])).toStrictEqual({
      imports: {
        'https://a/': ['https://d/', 'https://g/', 'https://h/', 'https://f/'],
        'https://b/': ['https://d/', 'https://g/', 'https://h/'],
        'https://c/': ['https://f/'],
        'https://e/': ['https://g/', 'https://h/']
      },
      scopes: {}
    });
  });

  it('should compose maps that are using the virtualization patterns we expect to see in the wild', () => {
    expect(composeMaps([
      `{
        "imports": {
          "${BUILT_IN_MODULE_SCHEME}:blank": "https://built-in-enhancement-1/"
        },
        "scopes": {
          "https://built-in-enhancement-1/": {
            "${BUILT_IN_MODULE_SCHEME}:blank": "${BUILT_IN_MODULE_SCHEME}:blank"
          }
        }
      }`,
      `{
        "imports": {
          "${BUILT_IN_MODULE_SCHEME}:blank": "https://built-in-enhancement-2/"
        },
        "scopes": {
          "https://built-in-enhancement-2/": {
            "${BUILT_IN_MODULE_SCHEME}:blank": "${BUILT_IN_MODULE_SCHEME}:blank"
          }
        }
      }`,
      `{
        "imports": {
          "${BUILT_IN_MODULE_SCHEME}:blank": "https://built-in-enhancement-3/"
        },
        "scopes": {
          "https://built-in-enhancement-3/": {
            "${BUILT_IN_MODULE_SCHEME}:blank": "${BUILT_IN_MODULE_SCHEME}:blank"
          }
        }
      }`
    ])).toStrictEqual({
      imports: { [`${BUILT_IN_MODULE_SCHEME}:blank`]: ['https://built-in-enhancement-3/'] },
      scopes: {
        'https://built-in-enhancement-1/': { [`${BUILT_IN_MODULE_SCHEME}:blank`]: [`${BUILT_IN_MODULE_SCHEME}:blank`] },
        'https://built-in-enhancement-2/': { [`${BUILT_IN_MODULE_SCHEME}:blank`]: ['https://built-in-enhancement-1/'] },
        'https://built-in-enhancement-3/': { [`${BUILT_IN_MODULE_SCHEME}:blank`]: ['https://built-in-enhancement-2/'] }
      }
    });
  });

  it('should compose equivalent scopes by merging', () => {
    expect(composeMaps([
      `{
        "imports": {},
        "scopes": {
          "/x/": {
            "/a": "/b",
            "/c": "/d"
          }
        }
      }`,
      `{
        "imports": {},
        "scopes": {
          "/x/": {
            "/c": "/z",
            "/e": "/f"
          }
        }
      }`
    ])).toStrictEqual({
      imports: {},
      scopes: {
        'https://example.com/x/': {
          'https://example.com/a': ['https://example.com/b'],
          'https://example.com/c': ['https://example.com/z'],
          'https://example.com/e': ['https://example.com/f']
        }
      }
    });
  });

  it('should use the merge-within-scopes strategy', () => {
    expect(composeMaps([
      `{
        "imports": {
          "a": "/a-1.mjs",
          "b": "/b-1.mjs",
          "${BUILT_IN_MODULE_SCHEME}:blank": ["${BUILT_IN_MODULE_SCHEME}:blank", "/blank-1.mjs"]
        },
        "scopes": {
          "/scope1/": {
            "a": "/a-2.mjs"
          }
        }
      }`,
      `{
        "imports": {
          "b": null,
          "${BUILT_IN_MODULE_SCHEME}:blank": "/blank-2.mjs"
        },
        "scopes": {
          "/scope1/": {
            "b": "/b-2.mjs"
          }
        }
      }`
    ])).toStrictEqual({
      imports: {
        a: ['https://example.com/a-1.mjs'],
        b: [],
        [`${BUILT_IN_MODULE_SCHEME}:blank`]: ['https://example.com/blank-2.mjs']
      },
      scopes: {
        'https://example.com/scope1/': {
          a: ['https://example.com/a-2.mjs'],
          b: ['https://example.com/b-2.mjs']
        }
      }
    });
  });

  it('should strip bare specifiers on the RHS and warn (empty first map)', () => {
    const assertWarnings = testWarningHandler([
      'Non-URL specifier "b" is not allowed to be the target of an import mapping following composition.',
      'Non-URL specifier "d" is not allowed to be the target of an import mapping following composition.'
    ]);
    expect(composeMaps([
      `{}`,
      `{
        "imports": {
          "a": "b",
          "c": ["d", "/"]
        }
      }`
    ])).toStrictEqual({
      imports: {
        a: [],
        c: ['https://example.com/']
      },
      scopes: {}
    });
    assertWarnings();
  });

  it('should strip bare specifiers on the RHS and warn (non-empty first map)', () => {
    const assertWarnings = testWarningHandler([
      'Non-URL specifier "d" is not allowed to be ' +
      'the target of an import mapping following composition.'
    ]);
    expect(composeMaps([
      `{
        "imports": {
          "a": "/a.mjs"
        }
      }`,
      `{
        "imports": {
          "b": "a",
          "c": "d"
        }
      }`
    ])).toStrictEqual({
      imports: {
        a: ['https://example.com/a.mjs'],
        b: ['https://example.com/a.mjs'],
        c: []
      },
      scopes: {}
    });
    assertWarnings();
  });

  it('should not be confused by different representations of URLs', () => {
    expect(composeMaps([
      `{
        "imports": {
          "/a": "/b",
          "/c": "/d",
          "/e": "/f",
          "/g": "/h",
          "/i": "/j"
        }
      }`,
      `{
        "imports": {
          "/v": "/%61",
          "/w": "/useless/../c",
          "/x": "../../../../../e",
          "/y": "./useless%2F..%2F..%2F/g",
          "/z": "https://example.com/i"
        }
      }`
    ])).toStrictEqual({
      imports: {
        'https://example.com/a': ['https://example.com/b'],
        'https://example.com/c': ['https://example.com/d'],
        'https://example.com/e': ['https://example.com/f'],
        'https://example.com/g': ['https://example.com/h'],
        'https://example.com/i': ['https://example.com/j'],

        'https://example.com/v': ['https://example.com/%61'],
        'https://example.com/w': ['https://example.com/d'],
        'https://example.com/x': ['https://example.com/f'],
        'https://example.com/y': ['https://example.com/app/useless%2F..%2F..%2F/g'],
        'https://example.com/z': ['https://example.com/j']
      },
      scopes: {}
    });
  });

  it('should compose "nested" scopes', () => {
    expect(composeMaps([
      `{
        "imports": { "https://a/": "https://b/" },
        "scopes": {
          "https://example.com/x/y/": { "https://c/": "https://d/" },
          "https://example.com/x/y/z": { "https://e/": "https://f/" }
        }
      }`,
      `{
        "imports": { "https://m/": "https://n/" },
        "scopes": {
          "https://example.com/x/y/z": {
            "https://g/": "https://a/",
            "https://h/": "https://c/",
            "https://i/": "https://e/"
          }
        }
      }`
    ])).toStrictEqual({
      imports: {
        'https://a/': ['https://b/'],
        'https://m/': ['https://n/']
      },
      scopes: {
        'https://example.com/x/y/': { 'https://c/': ['https://d/'] },
        'https://example.com/x/y/z': {
          'https://e/': ['https://f/'],
          'https://g/': ['https://b/'],
          'https://h/': ['https://d/'],
          'https://i/': ['https://f/']
        }
      }
    });
  });

  it('should not clobber earlier more-specific scopes with later less-specific scopes', () => {
    expect(composeMaps([
      `{
        "imports": {},
        "scopes": {
          "https://example.com/x/y/": { "https://a/": "https://b/" },
          "https://example.com/x/y/z": { "https://c/": "https://d/" }
        }
      }`,
      `{
        "imports": {
          "https://a/": "https://e/"
        },
        "scopes": {
          "https://example.com/x/": {
            "https://c/": "https://f/"
          }
        }
      }`
    ])).toStrictEqual({
      imports: {
        'https://a/': ['https://e/']
      },
      scopes: {
        'https://example.com/x/': { 'https://c/': ['https://f/'] },
        'https://example.com/x/y/': { 'https://a/': ['https://b/'] },
        'https://example.com/x/y/z': { 'https://c/': ['https://d/'] }
      }
    });
  });

  it('composition does not result in a map cascading to itself even for package-prefix-relative resolution', () => {
    const assertWarnings = testWarningHandler([
      'Non-URL specifier "utils/foo.js" is not allowed to be ' +
      'the target of an import mapping following composition.'
    ]);
    expect(composeMaps([
      `{
        "imports": {
          "moment/": "/node_modules/moment/src/"
        }
      }`,
      `{
        "imports": {
          "utils/": "moment/",
          "foo": "utils/foo.js"
        }
      }`
    ])).toStrictEqual({
      imports: {
        'moment/': ['https://example.com/node_modules/moment/src/'],
        'utils/': ['https://example.com/node_modules/moment/src/'],
        foo: []
      },
      scopes: {}
    });
    assertWarnings();
  });

  it('should perform package-prefix-relative composition', () => {
    expect(composeMaps([
      `{
        "imports": {
          "moment/": "/node_modules/moment/src/"
        },
        "scopes": {}
      }`,
      `{
        "imports": {
          "utils/": "moment/lib/utils/",
          "is-date": "moment/lib/utils/is-date.js"
        },
        "scopes": {}
      }`,
      `{
        "imports": {
          "is-number": "utils/is-number.js"
        }
      }`
    ])).toStrictEqual({
      imports: {
        'moment/': ['https://example.com/node_modules/moment/src/'],
        'utils/': ['https://example.com/node_modules/moment/src/lib/utils/'],
        'is-date': ['https://example.com/node_modules/moment/src/lib/utils/is-date.js'],
        'is-number': ['https://example.com/node_modules/moment/src/lib/utils/is-number.js']
      },
      scopes: {}
    });
  });

  it('should URL-normalize things which have composed into URLs', () => {
    expect(composeMaps([
      `{
        "imports": {
          "a/": "https://example.com/x/"
        },
        "scopes": {}
      }`,
      `{
        "imports": {
          "dot-test": "a/測試"
        }
      }`
    ])).toStrictEqual({
      imports: {
        'a/': ['https://example.com/x/'],
        'dot-test': ['https://example.com/x/%E6%B8%AC%E8%A9%A6']
      },
      scopes: {}
    });
  });

  it('should compose according to the most specific applicable scope', () => {
    expect(composeMaps([
      `{
        "imports": {
          "a": "https://b/"
        },
        "scopes": {
          "x/": { "a": "https://c/" },
          "x/y/": { "a": "https://d/" },
          "x/y/z/": { "a": "https://e/" }
        }
      }`,
      `{
        "imports": {},
        "scopes": {
          "x/": {
            "a-x": "a"
          },
          "x/y/": {
            "a-y": "a"
          },
          "x/y/z/": {
            "a-z": "a"
          },
          "x/y/w/": {
            "a-w": "a"
          }
        }
      }`
    ])).toStrictEqual({
      imports: {
        a: ['https://b/']
      },
      scopes: {
        'https://example.com/app/x/': {
          a: ['https://c/'],
          'a-x': ['https://c/']
        },
        'https://example.com/app/x/y/': {
          a: ['https://d/'],
          'a-y': ['https://d/']
        },
        'https://example.com/app/x/y/z/': {
          a: ['https://e/'],
          'a-z': ['https://e/']
        },
        'https://example.com/app/x/y/w/': {
          'a-w': ['https://d/']
        }
      }
    });
  });

  it('should produce maps with scopes in sorted order', () => {
    expect(Object.keys(composeMaps([
      `{
        "imports": {},
        "scopes": {
          "https://example.com/x/": { "https://c/": "https://f/" }
        }
      }`,
      `{
        "imports": {},
        "scopes": {
          "https://example.com/x/y/": { "https://a/": "https://b/" },
          "https://example.com/x/y/z": { "https://c/": "https://d/" }
        }
      }`
    ]).scopes)).toStrictEqual([
      'https://example.com/x/y/z',
      'https://example.com/x/y/',
      'https://example.com/x/'
    ]);
  });
});

