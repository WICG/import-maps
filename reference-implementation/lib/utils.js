'use strict';
const { URL } = require('url');

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
