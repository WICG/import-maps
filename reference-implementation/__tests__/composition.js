'use strict';
const { URL } = require('url');
const { parseFromString } = require('../lib/parser.js');
const { appendMap } = require('../lib/composer.js');

const mapBaseURL = new URL('https://example.com/app/index.html');

// a convenience function for folding composition over a list of maps
function composeMaps(mapLikes, baseURL = mapBaseURL) {
  if (!Array.isArray(mapLikes) || mapLikes.length < 1) {
    throw new Error('composeMaps must be given a non-empty array of mapLikes');
  }
  let map = parseFromString(mapLikes.shift(), baseURL);
  for (const mapLike of mapLikes) {
    const newMap = parseFromString(mapLike, baseURL);
    map = appendMap(map, newMap);
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

    const resultMap = appendMap(parseFromString('{}', mapBaseURL), map);

    expect(resultMap).toStrictEqual(map);
    expect(resultMap.imports).not.toBe(map.imports);
    Object.entries(resultMap.imports).forEach(([k, v]) => {
      expect(v).not.toBe(map.imports[k]);
    });
    expect(resultMap.scopes).not.toBe(map.scopes);
    Object.entries(resultMap.scopes).forEach(([k, v]) => {
      expect(v).not.toBe(map.scopes[k]);
    });
  });

  it('should compose with the empty map on the right', () => {
    const map = parseFromString(`{
      "imports": { "https://a/": ["https://b/"] },
      "scopes": {
        "https://c/": { "https://d/": ["https://e/"] }
      }
    }`, mapBaseURL);

    const resultMap = appendMap(map, parseFromString('{}', mapBaseURL));

    expect(resultMap).toStrictEqual(map);
    expect(resultMap.imports).not.toBe(map.imports);
    Object.entries(resultMap.imports).forEach(([k, v]) => {
      expect(v).not.toBe(map.imports[k]);
    });
    expect(resultMap.scopes).not.toBe(map.scopes);
    Object.entries(resultMap.scopes).forEach(([k, v]) => {
      expect(v).not.toBe(map.scopes[k]);
    });
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
          "std:built-in": "https://built-in-enhancement-1/"
        },
        "scopes": {
          "https://built-in-enhancement-1/": {
            "std:built-in": "std:built-in"
          }
        }
      }`,
      `{
        "imports": {
          "std:built-in": "https://built-in-enhancement-2/"
        },
        "scopes": {
          "https://built-in-enhancement-2/": {
            "std:built-in": "std:built-in"
          }
        }
      }`,
      `{
        "imports": {
          "std:built-in": "https://built-in-enhancement-3/"
        },
        "scopes": {
          "https://built-in-enhancement-3/": {
            "std:built-in": "std:built-in"
          }
        }
      }`
    ])).toStrictEqual({
      imports: { 'std:built-in': ['https://built-in-enhancement-3/'] },
      scopes: {
        'https://built-in-enhancement-1/': { 'std:built-in': ['std:built-in'] },
        'https://built-in-enhancement-2/': { 'std:built-in': ['https://built-in-enhancement-1/'] },
        'https://built-in-enhancement-3/': { 'std:built-in': ['https://built-in-enhancement-2/'] }
      }
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

