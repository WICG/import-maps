'use strict';
const { parseFromString } = require('../../lib/parser.js');

function testWarningHandler(expectedWarnings) {
  const warnings = [];
  const { warn } = console;
  console.warn = function (warning) {
    warnings.push(warning);
  };
  return function () {
    console.warn = warn;
    expect(warnings).toEqual(expectedWarnings);
  };
}

exports.expectSpecifierMap = (input, baseURL, output, warnings = []) => {
  const checkWarnings = testWarningHandler(warnings.concat(warnings));

  expect(parseFromString(`{ "imports": ${input} }`, baseURL))
    .toEqual({ imports: output, scopes: {} });

  expect(parseFromString(`{ "scopes": { "https://scope.example/":  ${input} } }`, baseURL, () => {}))
    .toEqual({ imports: {}, scopes: { 'https://scope.example/': output } });

  checkWarnings();
};

exports.expectScopes = (inputArray, baseURL, outputArray, warnings = []) => {
  const checkWarnings = testWarningHandler(warnings);

  const inputScopesAsStrings = inputArray.map(scopePrefix => `"${scopePrefix}": {}`);
  const inputString = `{ "scopes": { ${inputScopesAsStrings.join(', ')} } }`;

  const outputScopesObject = {};
  for (const outputScopePrefix of outputArray) {
    outputScopesObject[outputScopePrefix] = {};
  }

  expect(parseFromString(inputString, baseURL)).toEqual({ imports: {}, scopes: outputScopesObject });

  checkWarnings();
};

exports.expectBad = (input, baseURL, warnings = []) => {
  const checkWarnings = testWarningHandler(warnings);
  expect(() => parseFromString(input, baseURL)).toThrow(TypeError);
  checkWarnings();
};
