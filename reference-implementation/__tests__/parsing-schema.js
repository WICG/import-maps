'use strict';
const { parseFromString } = require('..');
const { expectBad, expectSpecifierMap } = require('./helpers/parsing.js');

const nonObjectStrings = ['null', 'true', '1', '"foo"', '[]'];

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
