'use strict';
const { URL } = require('url');
const { tryURLLikeSpecifierParse } = require('./utils.js');

exports.resolve = (specifier, parsedImportMap, scriptURL) => {
  const asURL = tryURLLikeSpecifierParse(specifier, scriptURL);
  const normalizedSpecifier = asURL ? asURL.href : specifier;

  // TODO: support scopes!

  for (const [specifierKey, addressArray] of Object.entries(parsedImportMap.imports)) {
    if (addressArray.length > 1) {
      throw new Error('Not yet implemented');
    }
    if (addressArray.length === 0 && specifierKey === normalizedSpecifier) {
      throw new TypeError(`Specifier key ${normalizedSpecifier} was mapped to no addresses.`);
    }

    const address = addressArray[0]; // Per the above addressArray.length === 1
    if (specifierKey === normalizedSpecifier) {
      return address;
    }

    if (asURL === null && specifierKey.endsWith('/') && normalizedSpecifier.startsWith(specifierKey)) {
      const afterPrefix = normalizedSpecifier.substring(specifierKey.length);
      return new URL(afterPrefix, address);
    }
  }

  // The specifier was able to be turned into a URL, but wasn't remapped into anything.
  if (asURL) {
    return asURL;
  }

  throw new TypeError(`Unmapped bare specifier ${specifier}`);
};
