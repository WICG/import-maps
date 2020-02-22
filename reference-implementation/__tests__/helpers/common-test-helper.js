'use strict';
const assert = require('assert');
const { URL } = require('url');
const { parseFromString } = require('../../lib/parser.js');
const { resolve } = require('../../lib/resolver.js');
const { traceDepcache } = require('../../lib/depcache.js');

function assertNoExtraProperties(object, expectedProperties, description) {
  for (const actualProperty in object) {
    assert(
      expectedProperties.indexOf(actualProperty) !== -1,
      description + ': unexpected property ' + actualProperty
    );
  }
}

function assertOwnProperty(j, name) {
  assert(name in j);
}

// Parsed import maps in the reference implementation uses `URL`s instead of
// strings as the values of specifier maps, while
// expected import maps (taken from JSONs) uses strings.
// This function converts `m` (expected import maps or its part)
// into URL-based, for comparison.
function replaceStringWithURL(m) {
  if (typeof m === 'string') {
    return new URL(m);
  }
  if (m === null || typeof m !== 'object') {
    return m;
  }

  const result = {};
  for (const key in m) {
    result[key] = replaceStringWithURL(m[key]);
  }
  return result;
}

function runTests(j) {
  const { tests } = j;
  delete j.tests;

  if ('importMap' in j) {
    assertOwnProperty(j, 'importMap');
    assertOwnProperty(j, 'importMapBaseURL');
    try {
      j.parsedImportMap = parseFromString(
        JSON.stringify(j.importMap),
        new URL(j.importMapBaseURL)
      );
    } catch (e) {
      j.parsedImportMap = e;
    }
    delete j.importMap;
    delete j.importMapBaseURL;
  }

  assertNoExtraProperties(
    j,
    [
      'expectedResults', 'expectedParsedImportMap', 'expectedDepcache',
      'baseURL', 'name', 'parsedImportMap',
      'importMap', 'importMapBaseURL',
      'link', 'details'
    ],
    j.name
  );

  if (tests) {
    // Nested node.
    for (const testName in tests) {
      let fullTestName = testName;
      if (j.name) {
        fullTestName = j.name + ': ' + testName;
      }
      tests[testName].name = fullTestName;
      const k = Object.assign(Object.assign({}, j), tests[testName]);
      runTests(k);
    }
  } else {
    // Leaf node.
    for (const key of ['parsedImportMap', 'name']) {
      assertOwnProperty(j, key, j.name);
    }
    assert(
      'expectedResults' in j ||
           'expectedParsedImportMap' in j ||
           'expectedDepcache' in j,
      'expectedResults, expectedParsedImportMap or expectedDepcache should exist'
    );

    // Resolution tests.
    if ('expectedResults' in j) {
      it(j.name, () => {
        assertOwnProperty(j, 'baseURL');
        describe(
          'Import map registration should be successful for resolution tests',
          () => {
            expect(j.parsedImportMap).not.toBeInstanceOf(Error);
          }
        );

        for (const specifier in j.expectedResults) {
          const expected = j.expectedResults[specifier];
          if (expected === null) {
            expect(() => resolve(specifier, j.parsedImportMap, new URL(j.baseURL))).toThrow(TypeError);
          } else {
            // Should be resolved to `expected`.
            expect(resolve(specifier, j.parsedImportMap, new URL(j.baseURL))).toMatchURL(expected);
          }
        }
      });
    }

    // Parsing tests.
    if ('expectedParsedImportMap' in j) {
      it(j.name, () => {
        if (j.expectedParsedImportMap === null) {
          expect(j.parsedImportMap).toBeInstanceOf(TypeError);
        } else {
          expect(j.parsedImportMap)
            .toEqual(replaceStringWithURL(j.expectedParsedImportMap));
        }
      });
    }

    // Depcache tests
    if ('expectedDepcache' in j) {
      it(j.name, () => {
        assertOwnProperty(j, 'baseURL');
        describe(
          'Import map registration should be successful for resolution tests',
          () => {
            expect(j.parsedImportMap).not.toBeInstanceOf(Error);
          }
        );

        for (const specifier in j.expectedDepcache) {
          const resolved = resolve(specifier, j.parsedImportMap, new URL(j.baseURL));
          const traced = traceDepcache(resolved, j.parsedImportMap);
          expect(traced).toEqual(j.expectedDepcache[specifier]);
        }
      });
    }
  }
}

exports.runTests = runTests;
