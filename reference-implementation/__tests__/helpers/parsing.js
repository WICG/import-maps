'use strict';
const { parseFromString } = require('../../lib/parser.js');

function testWarningHandler(expectedWarnings) {
  const warnings = [];
  return {
    warn(warning) {
      warnings.push(warning);
    },
    checkWarnings() {
      expect(warnings).toEqual(expectedWarnings);
    }
  };
}

exports.expectSpecifierMap = (input, baseURL, output, warnings = []) => {
  const { warn, checkWarnings } = testWarningHandler(warnings);

  expect(parseFromString(`{ "imports": ${input} }`, baseURL, warn))
    .toEqual({ imports: output, scopes: {} });

  // warnings should be identical to the above, so skipped here
  expect(parseFromString(`{ "scopes": { "https://scope.example/":  ${input} } }`, baseURL, () => {}))
    .toEqual({ imports: {}, scopes: { 'https://scope.example/': output } });

  checkWarnings();
};

exports.expectScopes = (inputArray, baseURL, outputArray, warnings = []) => {
  const { warn, checkWarnings } = testWarningHandler(warnings);

  const inputScopesAsStrings = inputArray.map(scopePrefix => `"${scopePrefix}": {}`);
  const inputString = `{ "scopes": { ${inputScopesAsStrings.join(', ')} } }`;

  const outputScopesObject = {};
  for (const outputScopePrefix of outputArray) {
    outputScopesObject[outputScopePrefix] = {};
  }

  expect(parseFromString(inputString, baseURL, warn)).toEqual({ imports: {}, scopes: outputScopesObject });

  checkWarnings();
};

exports.expectBad = (input, baseURL, warnings = []) => {
  const { warn, checkWarnings } = testWarningHandler(warnings);
  expect(() => parseFromString(input, baseURL, warn)).toThrow(TypeError);
  checkWarnings();
};
