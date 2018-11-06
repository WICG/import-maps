'use strict';
const { URL } = require('url');

// https://fetch.spec.whatwg.org/#fetch-scheme
const FETCH_SCHEMES = new Set(['http', 'https', 'ftp', 'about', 'blob', 'data', 'file', 'filesystem']);

// Tentative, so better to centralize so we can change in one place as necessary (including tests).
exports.BUILT_IN_MODULE_PREFIX = '@std/';

exports.parseFromString = input => {
  const parsed = JSON.parse(input);

  if (!isJSONObject(parsed)) {
    throw new TypeError('Import map JSON must be an object.');
  }

  if ('imports' in parsed && !isJSONObject(parsed.imports)) {
    throw new TypeError('Import map\'s imports value must be an object.');
  }

  if ('scopes' in parsed && !isJSONObject(parsed.scopes)) {
    throw new TypeError('Import map\'s scopes value must be an object.');
  }

  if ('imports' in parsed) {
    normalizeSpecifierMap(parsed.imports);
  }

  if ('scopes' in parsed) {
    for (const [key, specifierMap] of Object.entries(parsed.scopes)) {
      if (!isJSONObject(specifierMap)) {
        throw new TypeError(`The value for the "${key}" scope must be an object.`);
      }
      normalizeSpecifierMap(specifierMap);
    }
  }

  // Always have these two keys, and exactly these two keys, in the result.
  return {
    imports: parsed.imports || {},
    scopes: parsed.scopes || {}
  };
};

function normalizeSpecifierMap(obj) {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      obj[key] = [value];
    } else if (!Array.isArray(value)) {
      delete obj[key];
    }
  }

  for (const [key, mapTargetsArray] of Object.entries(obj)) {
    obj[key] = mapTargetsArray.filter(isValidMapTarget);
  }
}

function isValidMapTarget(string) {
  if (typeof string !== 'string') {
    return false;
  }

  if (string.startsWith('./') || string.startsWith('../') || string.startsWith('/') ||
      string.startsWith(exports.BUILT_IN_MODULE_PREFIX)) {
    return true;
  }

  let url;
  try {
    url = new URL(string);
  } catch (e) { // TODO remove useless binding when eslint and Jest support it
    return false;
  }

  if (FETCH_SCHEMES.has(url.protocol.slice(0, -1))) {
    return true;
  }

  return false;
}

function isJSONObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
