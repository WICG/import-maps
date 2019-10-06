'use strict';
const { URL } = require('url');

// https://fetch.spec.whatwg.org/#fetch-scheme
const FETCH_SCHEMES = new Set(['http', 'https', 'ftp', 'about', 'blob', 'data', 'file', 'filesystem']);

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
  return url;
};

exports.hasFetchScheme = url => {
  return FETCH_SCHEMES.has(url.protocol.slice(0, -1));
};
