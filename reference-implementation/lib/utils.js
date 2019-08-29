'use strict';
const assert = require('assert');
const { URL } = require('url');

// https://fetch.spec.whatwg.org/#fetch-scheme
const FETCH_SCHEMES = new Set(['http', 'https', 'ftp', 'about', 'blob', 'data', 'file', 'filesystem']);

// Tentative, so better to centralize so we can change in one place as necessary (including tests).
exports.BUILT_IN_MODULE_SCHEME = 'std';

// Useful for comparing to .protocol
exports.BUILT_IN_MODULE_PROTOCOL = `${exports.BUILT_IN_MODULE_SCHEME}:`;

exports.tryURLParse = (string, baseURL) => {
  if (baseURL !== undefined) {
    // It's easy to accidentally conflate strings and URLs; make sure everything that reaches us was the right type.
    assert.strictEqual(baseURL.constructor, URL);
  }

  try {
    return new URL(string, baseURL);
  } catch (e) { // TODO remove useless binding when ESLint and Jest support that
    return null;
  }
};

exports.parseSpecifier = (specifier, baseURL) => {
  if (specifier === '') {
    return { type: 'invalid', specifier: null, message: 'Invalid empty string specifier.' };
  }

  if (specifier.startsWith('/') || specifier.startsWith('./') || specifier.startsWith('../')) {
    const parsedURL = exports.tryURLParse(specifier, baseURL);
    if (!parsedURL) {
      return { type: 'invalid', specifier: null,
        message: `Path-based module specifier ${JSON.stringify(specifier)} ` +
        `cannot be parsed against the base URL ${JSON.stringify(baseURL.href)}.` };
    }
    return { type: 'URL', specifier: parsedURL.href };
  }

  const url = exports.tryURLParse(specifier);

  if (url === null) {
    return { type: 'non-URL', specifier };
  }

  if (exports.hasFetchScheme(url) || url.protocol === exports.BUILT_IN_MODULE_PROTOCOL) {
    return { type: 'URL', specifier: url.href };
  }

  return { type: 'non-URL', specifier };
};

exports.hasFetchScheme = url => {
  return FETCH_SCHEMES.has(url.protocol.slice(0, -1));
};

exports.sortObjectKeysByLongestFirst = obj => {
  const sortedEntries = Object.entries(obj).sort((a, b) => longerLengthThenCodeUnitOrder(a[0], b[0]));
  return Object.fromEntries(sortedEntries);
};

function longerLengthThenCodeUnitOrder(a, b) {
  return compare(b.length, a.length) || compare(a, b);
}

function compare(a, b) {
  if (a > b) {
    return 1;
  }
  if (b > a) {
    return -1;
  }
  return 0;
}
