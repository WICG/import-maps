'use strict';
const { parseFromString } = require('../..');

exports.expectSpecifierMap = (input, baseURL, output) => {
  expect(parseFromString(`{ "imports": ${input} }`, baseURL))
    .toEqual({ imports: output, scopes: {} });

  expect(parseFromString(`{ "scopes": { "https://scope.example/":  ${input} } }`, baseURL))
    .toEqual({ imports: {}, scopes: { 'https://scope.example/': output } });
};

exports.expectScopes = (inputArray, baseURL, outputArray) => {
  const inputScopesAsStrings = inputArray.map(scopePrefix => `"${scopePrefix}": {}`);
  const inputString = `{ "scopes": { ${inputScopesAsStrings.join(', ')} } }`;

  const outputScopesObject = {};
  for (const outputScopePrefix of outputArray) {
    outputScopesObject[outputScopePrefix] = {};
  }

  expect(parseFromString(inputString, baseURL)).toEqual({ imports: {}, scopes: outputScopesObject });
};

exports.expectBad = (input, baseURL) => {
  expect(() => parseFromString(input, baseURL)).toThrow(TypeError);
};
