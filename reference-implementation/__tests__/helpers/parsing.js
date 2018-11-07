'use strict';
const { parseFromString } = require('../..');

exports.expectSpecifierMap = (input, baseURL, output) => {
  expect(parseFromString(`{ "imports": ${input} }`, baseURL))
    .toEqual({ imports: output, scopes: {} });

  expect(parseFromString(`{ "scopes": { "aScope":  ${input} } }`, baseURL))
    .toEqual({ imports: {}, scopes: { aScope: output } });
};

exports.expectBad = (input, baseURL) => {
  expect(() => parseFromString(input, baseURL)).toThrow(TypeError);
};
