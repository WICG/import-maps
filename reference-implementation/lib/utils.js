'use strict';
const { URL } = require('url');

// https://fetch.spec.whatwg.org/#fetch-scheme
const FETCH_SCHEMES = new Set(['http', 'https', 'ftp', 'about', 'blob', 'data', 'file', 'filesystem']);

// Tentative, so better to centralize so we can change in one place as necessary (including tests).
exports.BUILT_IN_MODULE_SCHEME = 'std';

// Useful for comparing to .protocol
exports.BUILT_IN_MODULE_PROTOCOL = `${exports.BUILT_IN_MODULE_SCHEME}:`;

exports.tryURLParse = (string, baseURL) => {
  try {
    return new URL(string, baseURL);
  } catch (e) { // TODO remove useless binding when ESLint and Jest support that
    return null;
  }
};

exports.tryURLLikeSpecifierParse = (specifier, baseURL) => {
  if (specifier === '') {
    return { type: 'invalid', message: 'Invalid empty string specifier.' };
  }

  if (specifier.startsWith('/') || specifier.startsWith('./') || specifier.startsWith('../')) {
    if (baseURL.protocol === 'data:') {
      return { type: 'invalid', message: `Path-based module specifier ${JSON.stringify(specifier)} ` +
        'cannot be used with a base URL that uses the "data:" scheme.' };
    }
    return { type: 'url', specifier: new URL(specifier, baseURL).href, isBuiltin: false };
  }

  const url = exports.tryURLParse(specifier);

  if (url === null) {
    return { type: 'nonURL', specifier };
  }

  if (exports.hasFetchScheme(url)) {
    return { type: 'url', specifier: url.href, isBuiltin: false };
  }

  if (url.protocol === exports.BUILT_IN_MODULE_PROTOCOL) {
    return { type: 'url', specifier: url.href, isBuiltin: true };
  }

  return { type: 'nonURL', specifier };
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
