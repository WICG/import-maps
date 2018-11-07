'use strict';
const { URL } = require('url');

// https://fetch.spec.whatwg.org/#fetch-scheme
const FETCH_SCHEMES = new Set(['http', 'https', 'ftp', 'about', 'blob', 'data', 'file', 'filesystem']);

// Tentative, so better to centralize so we can change in one place as necessary (including tests).
exports.BUILT_IN_MODULE_PREFIX = '@std/';

exports.parseFromString = (input, baseURL) => {
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
    normalizeSpecifierMap(parsed.imports, baseURL);
  }

  if ('scopes' in parsed) {
    for (const [key, specifierMap] of Object.entries(parsed.scopes)) {
      if (!isJSONObject(specifierMap)) {
        throw new TypeError(`The value for the "${key}" scope must be an object.`);
      }
      normalizeSpecifierMap(specifierMap, baseURL);
    }
  }

  // Always have these two keys, and exactly these two keys, in the result.
  return {
    imports: parsed.imports || {},
    scopes: parsed.scopes || {}
  };
};

function normalizeSpecifierMap(obj, baseURL) {
  delete obj[''];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      obj[key] = [value];
    } else if (!Array.isArray(value)) {
      delete obj[key];
    }
  }

  for (const [key, mapTargetsArray] of Object.entries(obj)) {
    obj[key] = mapTargetsArray
      .map(string => normalizeMapTargetString(string, baseURL))
      .filter(target => target !== null);
  }
}

// Returns null if the value is not a valid map target; a string otherwise
function normalizeMapTargetString(string, baseURL) {
  if (typeof string !== 'string') {
    return null;
  }

  if (string.startsWith(exports.BUILT_IN_MODULE_PREFIX)) {
    return new URL('import:' + string);
  }

  if (string.startsWith('./') || string.startsWith('../') || string.startsWith('/')) {
    return new URL(string, baseURL);
  }

  let url;
  try {
    url = new URL(string);
  } catch (e) { // TODO remove useless binding when eslint and Jest support it
    return null;
  }

  if (FETCH_SCHEMES.has(url.protocol.slice(0, -1))) {
    return url;
  }

  return null;
}

function isJSONObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
