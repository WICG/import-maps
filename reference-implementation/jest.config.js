'use strict';

module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/__tests__/helpers/'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/helpers/matchers.js'],
  coverageThreshold: {
    './lib/**': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  }
};
