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
  if (specifier.startsWith('/') || specifier.startsWith('./') || specifier.startsWith('../')) {
    return exports.tryURLParse(specifier, baseURL);
  }

  const url = exports.tryURLParse(specifier);

  if (url === null) {
    return null;
  }

  if (exports.hasFetchScheme(url) || url.protocol === exports.BUILT_IN_MODULE_PROTOCOL) {
    return url;
  }

  return null;
};

exports.hasFetchScheme = url => {
  return FETCH_SCHEMES.has(url.protocol.slice(0, -1));
};
