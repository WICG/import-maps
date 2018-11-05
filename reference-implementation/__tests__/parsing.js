'use strict';
const { parseFromString } = require('..');

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

  it('should throw if neither imports nor scopes keys are present', () => {
    expectBad('{}');
    expectBad('{ "importz": {} }');
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

  it('should strip out unspecified top-level entries', () => {
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
            "bar": "./valid"
          }
        }`))
          .toEqual({ imports: { bar: './valid' }, scopes: {} });
      }
    });

    it('should ignore entries where the map target is an array of not-all-strings', () => {
      for (const invalid of invalidInsideArrayStrings) {
        expect(parseFromString(`{
          "imports": {
            "foo": ["./valid", ${invalid}],
            "bar": "./valid"
          }
        }`))
          .toEqual({ imports: { bar: './valid' }, scopes: {} });
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
              "bar": "./valid"
            }
          }
        }`))
          .toEqual({ imports: {}, scopes: { someScope: { bar: './valid' } } });
      }
    });

    it('should ignore entries where the map target is an array of not-all-strings', () => {
      for (const invalid of invalidInsideArrayStrings) {
        expect(parseFromString(`{
          "scopes": {
            "someScope": {
              "foo": ["./valid", ${invalid}],
              "bar": "./valid"
            }
          }
        }`))
          .toEqual({ imports: {}, scopes: { someScope: { bar: './valid' } } });
      }
    });
  });
});
