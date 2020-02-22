'use strict';
const { runTests } = require('./helpers/common-test-helper.js');
for (const jsonFile of [
  'data-base-url.json',
  'depcache.json',
  'empty-import-map.json',
  'overlapping-entries.json',
  'packages-via-trailing-slashes.json',
  'parsing-addresses-absolute.json',
  'parsing-addresses-invalid.json',
  'parsing-addresses.json',
  'parsing-invalid-json.json',
  'parsing-schema-normalization.json',
  'parsing-schema-scope.json',
  'parsing-schema-specifier-map.json',
  'parsing-schema-toplevel.json',
  'parsing-scope-keys.json',
  'parsing-specifier-keys.json',
  'parsing-trailing-slashes.json',
  'resolving-null.json',
  'scopes-exact-vs-prefix.json',
  'scopes.json',
  'tricky-specifiers.json',
  'url-specifiers.json'
]) {
  describe(jsonFile, () => {
    const j = require('./json/' + jsonFile); // eslint-disable-line global-require
    runTests(j);
  });
}
