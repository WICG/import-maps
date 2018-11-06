'use strict';
const { parseFromString, BUILT_IN_MODULE_PREFIX } = require('..');

const nonObjectStrings = ['null', 'true', '1', '"foo"', '[]'];

function expectBad(input) {
  expect(() => parseFromString(input)).toThrow(TypeError);
}

test('Invalid JSON', () => {
  expect(() => parseFromString('{ imports: {} }')).toThrow(SyntaxError);
});

describe('Mismatching the top-level schema', () => {
  it('should throw for top-level non-objects', () => {
    for (const nonObject of nonObjectStrings) {
      expectBad(nonObject);
    }
  });

  it('should throw if imports is a non-object', () => {
    for (const nonObject of nonObjectStrings) {
      expectBad(`{ "imports": ${nonObject} }`);
    }
  });

  it('should throw if scopes is a non-object', () => {
    for (const nonObject of nonObjectStrings) {
      expectBad(`{ "scopes": ${nonObject} }`);
    }
  });

  it('should ignore unspecified top-level entries', () => {
    expect(parseFromString(`{
      "imports": {},
      "new-feature": {}
    }`))
      .toEqual({ imports: {}, scopes: {} });
  });
});

describe('Mismatching the specifier map schema', () => {
  const invalidMapTargetStrings = ['null', 'true', '1', '{}'];
  const invalidInsideArrayStrings = ['null', 'true', '1', '{}', '[]'];

  describe('Directly under imports', () => {
    it('should ignore entries where the map target is not a string or array', () => {
      for (const invalid of invalidMapTargetStrings) {
        expect(parseFromString(`{
          "imports": {
            "foo": ${invalid},
            "bar": ["./valid"]
          }
        }`))
          .toEqual({ imports: { bar: ['./valid'] }, scopes: {} });
      }
    });

    it('should ignore members of a map target array that are not strings', () => {
      for (const invalid of invalidInsideArrayStrings) {
        expect(parseFromString(`{
          "imports": {
            "foo": ["./valid", ${invalid}],
            "bar": ["./valid"]
          }
        }`))
          .toEqual({ imports: {
            foo: ['./valid'],
            bar: ['./valid']
          }, scopes: {} });
      }
    });
  });

  describe('Underneath a scope', () => {
    it('should throw if the scope value is not an object', () => {
      for (const invalid of nonObjectStrings) {
        expectBad(`{ "scopes": { "someScope": ${invalid} } }`);
      }
    });

    it('should ignore entries where the map target is not a string or array', () => {
      for (const invalid of invalidMapTargetStrings) {
        expect(parseFromString(`{
          "scopes": {
            "someScope": {
              "foo": ${invalid},
              "bar": ["./valid"]
            }
          }
        }`))
          .toEqual({ imports: {}, scopes: {
            someScope: {
              bar: ['./valid']
            }
          } });
      }
    });

    it('should ignore members of a map target array that are not strings', () => {
      for (const invalid of invalidInsideArrayStrings) {
        expect(parseFromString(`{
          "scopes": {
            "someScope": {
              "foo": ["./valid", ${invalid}],
              "bar": ["./valid"]
            }
          }
        }`))
          .toEqual({ imports: {}, scopes: {
            someScope: {
              foo: ['./valid'],
              bar: ['./valid']
            }
          } });
      }
    });
  });
});

describe('Normalization', () => {
  it('should normalize empty maps to have imports and scopes keys', () => {
    expect(parseFromString(`{}`)).toEqual({ imports: {}, scopes: {} });
  });

  it('should normalize a map without imports to have imports', () => {
    expect(parseFromString(`{ "scopes": {} }`)).toEqual({ imports: {}, scopes: {} });
  });

  it('should normalize a map without scopes to have scopes', () => {
    expect(parseFromString(`{ "imports": {} }`)).toEqual({ imports: {}, scopes: {} });
  });

  it('should normalize map targets to arrays inside "imports"', () => {
    expect(parseFromString(`{
      "imports": {
        "foo": "./valid1",
        "bar": ["./valid2"]
      }
    }`))
      .toEqual({ imports: {
        foo: ['./valid1'],
        bar: ['./valid2']
      }, scopes: {} });
  });

  it('should normalize map targets to arrays inside scopes', () => {
    expect(parseFromString(`{
      "scopes": {
        "aScope": {
          "foo": "./valid1",
          "bar": ["./valid2"]
        }
      }
    }`))
      .toEqual({ imports: {}, scopes: {
        aScope: {
          foo: ['./valid1'],
          bar: ['./valid2']
        }
      } });
  });
});

describe('Map target string validation', () => {
  it('should accept strings prefixed with ./, ../, or /', () => {
    expect(parseFromString(`{
      "imports": {
        "dotSlash": "./foo",
        "dotDotSlash": "../foo",
        "slash": "/foo"
      }
    }`))
      .toEqual({ imports: {
        dotSlash: ['./foo'],
        dotDotSlash: ['../foo'],
        slash: ['/foo']
      }, scopes: {} });
  });

  it('should accept the literal strings ./, ../, or / with no suffix', () => {
    expect(parseFromString(`{
      "imports": {
        "dotSlash": "./",
        "dotDotSlash": "../",
        "slash": "/"
      }
    }`))
      .toEqual({ imports: {
        dotSlash: ['./'],
        dotDotSlash: ['../'],
        slash: ['/']
      }, scopes: {} });
  });

  it('should ignore percent-encoded variants of ./, ../, or /', () => {
    expect(parseFromString(`{
      "imports": {
        "dotSlash1": "%2E/",
        "dotDotSlash1": "%2E%2E/",
        "dotSlash2": ".%2F",
        "dotDotSlash2": "..%2F",
        "slash2": "%2F",
        "dotSlash3": "%2E%2F",
        "dotDotSlash3": "%2E%2E%2F"
      }
    }`))
      .toEqual({ imports: {
        dotSlash1: [],
        dotDotSlash1: [],
        dotSlash2: [],
        dotDotSlash2: [],
        slash2: [],
        dotSlash3: [],
        dotDotSlash3: []
      }, scopes: {} });
  });

  it('should accept strings prefixed with the built-in module prefix', () => {
    expect(parseFromString(`{
      "imports": {
        "foo": "${BUILT_IN_MODULE_PREFIX}foo"
      }
    }`))
      .toEqual({ imports: {
        foo: [`${BUILT_IN_MODULE_PREFIX}foo`]
      }, scopes: {} });
  });

  it('should ignore percent-encoded variants of the built-in module prefix', () => {
    expect(parseFromString(`{
      "imports": {
        "foo": "${encodeURIComponent(BUILT_IN_MODULE_PREFIX)}foo"
      }
    }`))
      .toEqual({ imports: {
        foo: []
      }, scopes: {} });
  });

  it('should ignore other unprefixed strings', () => {
    for (const bad of ['bar', '\\bar', '~bar', '#bar', '?bar']) {
      expect(parseFromString(`{
        "imports": {
          "foo": "${bad}"
        }
      }`))
        .toEqual({ imports: {
          foo: []
        }, scopes: {} });
    }
  });

  it('should only accept URL-string map targets with fetch schemes', () => {
    expect(parseFromString(`{
      "imports": {
        "about": "about:good",
        "blob": "blob:good",
        "data": "data:good",
        "file": "file:good",
        "filesystem": "filesystem:good",
        "http": "http:good",
        "https": "https:good",
        "ftp": "ftp:good",
        "import": "import:bad",
        "mailto": "mailto:bad",
        "javascript": "javascript:bad",
        "wss": "wss:bad"
      }
    }`))
      .toEqual({ imports: {
        about: ['about:good'],
        blob: ['blob:good'],
        data: ['data:good'],
        file: ['file:good'],
        filesystem: ['filesystem:good'],
        http: ['http:good'],
        https: ['https:good'],
        ftp: ['ftp:good'],
        import: [],
        mailto: [],
        javascript: [],
        wss: []
      }, scopes: {} });
  });

  it('should only accept URL-string map targets with fetch schemes inside arrays', () => {
    expect(parseFromString(`{
      "imports": {
        "about": ["./valid1", "about:good", "../valid2"],
        "blob": ["./valid1", "blob:good", "../valid2"],
        "data": ["./valid1", "data:good", "../valid2"],
        "file": ["./valid1", "file:good", "../valid2"],
        "filesystem": ["./valid1", "filesystem:good", "../valid2"],
        "http": ["./valid1", "http:good", "../valid2"],
        "https": ["./valid1", "https:good", "../valid2"],
        "ftp": ["./valid1", "ftp:good", "../valid2"],
        "import": ["./valid1", "import:bad", "../valid2"],
        "mailto": ["./valid1", "mailto:bad", "../valid2"],
        "javascript": ["./valid1", "javascript:bad", "../valid2"],
        "wss": ["./valid1", "wss:bad", "../valid2"]
      }
    }`))
      .toEqual({ imports: {
        about: ['./valid1', 'about:good', '../valid2'],
        blob: ['./valid1', 'blob:good', '../valid2'],
        data: ['./valid1', 'data:good', '../valid2'],
        file: ['./valid1', 'file:good', '../valid2'],
        filesystem: ['./valid1', 'filesystem:good', '../valid2'],
        http: ['./valid1', 'http:good', '../valid2'],
        https: ['./valid1', 'https:good', '../valid2'],
        ftp: ['./valid1', 'ftp:good', '../valid2'],
        import: ['./valid1', '../valid2'],
        mailto: ['./valid1', '../valid2'],
        javascript: ['./valid1', '../valid2'],
        wss: ['./valid1', '../valid2']
      }, scopes: {} });
  });
});
