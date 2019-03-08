'use strict';

module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/__tests__/helpers/'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/helpers/matchers.js']
};
