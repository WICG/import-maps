'use strict';
const { parseFromString } = require('../..');

exports.expectSpecifierMap = (input, output) => {
  expect(parseFromString(`{ "imports": ${input} }`))
    .toEqual({ imports: output, scopes: {} });

  expect(parseFromString(`{ "scopes": { "aScope":  ${input} } }`))
    .toEqual({ imports: {}, scopes: { aScope: output } });
};

exports.expectBad = input => {
  expect(() => parseFromString(input)).toThrow(TypeError);
};
