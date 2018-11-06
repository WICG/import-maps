'use strict';
const { parseFromString, BUILT_IN_MODULE_PREFIX } = require('..');

const nonObjectStrings = ['null', 'true', '1', '"foo"', '[]'];

function expectBad(input) {
  expect(() => parseFromString(input)).toThrow(TypeError);
}

function expectSpecifierMap(input, output) {
  expect(parseFromString(`{ "imports": ${input} }`))
    .toEqual({ imports: output, scopes: {} });

  expect(parseFromString(`{ "scopes": { "aScope":  ${input} } }`))
    .toEqual({ imports: {}, scopes: { aScope: output } });
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

  it('should ignore entries where the map target is not a string or array', () => {
    for (const invalid of invalidMapTargetStrings) {
      expectSpecifierMap(
        `{
          "foo": ${invalid},
          "bar": ["./valid"]
        }`,
        {
          bar: ['./valid']
        }
      );
    }
  });

  it('should ignore members of a map target array that are not strings', () => {
    for (const invalid of invalidInsideArrayStrings) {
      expectSpecifierMap(
        `{
          "foo": ["./valid", ${invalid}],
          "bar": ["./valid"]
        }`,
        {
          foo: ['./valid'],
          bar: ['./valid']
        }
      );
    }
  });

  it('should throw if the scope value is not an object', () => {
    for (const invalid of nonObjectStrings) {
      expectBad(`{ "scopes": { "someScope": ${invalid} } }`);
    }
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

  it('should normalize map targets to arrays', () => {
    expectSpecifierMap(
      `{
        "foo": "./valid1",
        "bar": ["./valid2"]
      }`,
      {
        foo: ['./valid1'],
        bar: ['./valid2']
      }
    );
  });
});

describe('Map target string validation', () => {
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

  it('should only accept URL-string map targets with fetch schemes', () => {
    expectSpecifierMap(
      `{
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
      }`,
      {
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
      }
    );
  });

  it('should only accept URL-string map targets with fetch schemes inside arrays', () => {
    expectSpecifierMap(
      `{
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
      }`,
      {
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
      }
    );
  });
});
