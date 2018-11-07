'use strict';
const { parseFromString } = require('..');
const { expectBad, expectSpecifierMap } = require('./helpers/parsing.js');

const nonObjectStrings = ['null', 'true', '1', '"foo"', '[]'];

test('Invalid JSON', () => {
  expect(() => parseFromString('{ imports: {} }', 'https://base.example/')).toThrow(SyntaxError);
});

describe('Mismatching the top-level schema', () => {
  it('should throw for top-level non-objects', () => {
    for (const nonObject of nonObjectStrings) {
      expectBad(nonObject, 'https://base.example/');
    }
  });

  it('should throw if imports is a non-object', () => {
    for (const nonObject of nonObjectStrings) {
      expectBad(`{ "imports": ${nonObject} }`, 'https://base.example/');
    }
  });

  it('should throw if scopes is a non-object', () => {
    for (const nonObject of nonObjectStrings) {
      expectBad(`{ "scopes": ${nonObject} }`, 'https://base.example/');
    }
  });

  it('should ignore unspecified top-level entries', () => {
    expect(parseFromString(`{
      "imports": {},
      "new-feature": {}
    }`, 'https://base.example/'))
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
          "bar": ["https://example.com/"]
        }`,
        'https://base.example/',
        {
          bar: [expect.toMatchURL('https://example.com/')]
        }
      );
    }
  });

  it('should ignore members of a map target array that are not strings', () => {
    for (const invalid of invalidInsideArrayStrings) {
      expectSpecifierMap(
        `{
          "foo": ["https://example.com/", ${invalid}],
          "bar": ["https://example.com/"]
        }`,
        'https://base.example/',
        {
          foo: [expect.toMatchURL('https://example.com/')],
          bar: [expect.toMatchURL('https://example.com/')]
        }
      );
    }
  });

  it('should throw if the scope value is not an object', () => {
    for (const invalid of nonObjectStrings) {
      expectBad(`{ "scopes": { "someScope": ${invalid} } }`, 'https://base.example/');
    }
  });
});

describe('Normalization', () => {
  it('should normalize empty maps to have imports and scopes keys', () => {
    expect(parseFromString(`{}`, 'https://base.example/'))
      .toEqual({ imports: {}, scopes: {} });
  });

  it('should normalize a map without imports to have imports', () => {
    expect(parseFromString(`{ "scopes": {} }`, 'https://base.example/'))
      .toEqual({ imports: {}, scopes: {} });
  });

  it('should normalize a map without scopes to have scopes', () => {
    expect(parseFromString(`{ "imports": {} }`, 'https://base.example/'))
      .toEqual({ imports: {}, scopes: {} });
  });

  it('should normalize map targets to arrays', () => {
    expectSpecifierMap(
      `{
        "foo": "https://example.com/1",
        "bar": ["https://example.com/2"]
      }`,
      'https://base.example/',
      {
        foo: [expect.toMatchURL('https://example.com/1')],
        bar: [expect.toMatchURL('https://example.com/2')]
      }
    );
  });
});
