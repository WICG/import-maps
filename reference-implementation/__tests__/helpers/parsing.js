'use strict';
const { parseFromString } = require('../../lib/parser.js');

exports.expectSpecifierMap = (input, baseURL, output, warnings = []) => {
  const checkWarnings1 = exports.testWarningHandler(warnings);

  expect(parseFromString(`{ "imports": ${input} }`, baseURL))
    .toEqual({ imports: output, scopes: {} });

  checkWarnings1();

  const checkWarnings2 = exports.testWarningHandler(warnings);

  expect(parseFromString(`{ "scopes": { "https://scope.example/":  ${input} } }`, baseURL))
    .toEqual({ imports: {}, scopes: { 'https://scope.example/': output } });

  checkWarnings2();
};

exports.expectScopes = (inputArray, baseURL, outputArray, warnings = []) => {
  const checkWarnings = exports.testWarningHandler(warnings);

  const inputScopesAsStrings = inputArray.map(scopePrefix => `${JSON.stringify(scopePrefix)}: {}`);
  const inputString = `{ "scopes": { ${inputScopesAsStrings.join(', ')} } }`;

  const outputScopesObject = {};
  for (const outputScopePrefix of outputArray) {
    outputScopesObject[outputScopePrefix] = {};
  }

  expect(parseFromString(inputString, baseURL)).toEqual({ imports: {}, scopes: outputScopesObject });

  checkWarnings();
};

exports.expectBad = (input, baseURL, warnings = []) => {
  const checkWarnings = exports.testWarningHandler(warnings);
  expect(() => parseFromString(input, baseURL)).toThrow(TypeError);
  checkWarnings();
};

exports.expectWarnings = (input, baseURL, output, warnings) => {
  const checkWarnings = exports.testWarningHandler(warnings);
  expect(parseFromString(input, baseURL)).toEqual(output);

  checkWarnings();
};

exports.testWarningHandler = expectedWarnings => {
  const warnings = [];
  const { warn } = console;
  console.warn = warning => {
    warnings.push(warning);
  };
  return () => {
    console.warn = warn;
    expect(warnings).toEqual(expectedWarnings);
  };
};
