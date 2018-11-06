'use strict';

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
    if (Array.isArray(value)) {
      for (const entryInArray of value) {
        if (typeof entryInArray !== 'string') {
          delete obj[key];
          continue;
        }
      }
    } else if (typeof value === 'string') {
      obj[key] = [value];
    } else {
      delete obj[key];
    }
  }
}

function isJSONObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
