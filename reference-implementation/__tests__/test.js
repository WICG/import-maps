'use strict';
const fs = require('fs');
const path = require('path');
const { runTests } = require('./helpers/common-test-helper.js');

for (const jsonFile of fs.readdirSync(path.resolve(__dirname, 'json'))) {
  describe(jsonFile, () => {
    const j = require('./json/' + jsonFile); // eslint-disable-line global-require
    runTests(j);
  });
}
