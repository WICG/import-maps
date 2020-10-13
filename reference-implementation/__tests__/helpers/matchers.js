'use strict';
const { URL } = require('url');
const diff = require('jest-diff');

expect.extend({
  // This largely exists to work around https://github.com/nodejs/node/issues/24211.
  toMatchURL(received, expected) {
    if (!received || !('href' in received) || typeof received.href !== 'string') {
      throw new Error(this.utils.matcherHint('[.not].toMatchURL', 'received', 'href') +
        '\n\n' +
        `Expected value to have a 'href' property that is a string. ` +
        `Received:\n` +
        `  ${this.utils.printReceived(received)}\n` +
        (received ? `received.href:\n  ${this.utils.printReceived(received.href)}` : ''));
    }

    received = received.href;
    expected = new URL(expected).href;

    const pass = received === expected;

    const message = pass ?
      () => {
        return this.utils.matcherHint('.not.toMatchURL') +
          '\n\n' +
          `Expected value to not match the URL (serialized):\n` +
          `  ${this.utils.printExpected(expected)}\n` +
          `Received:\n` +
          `  ${this.utils.printReceived(received)}`;
      } :
      () => {
        const diffString = diff(expected, received, {
          expand: this.expand
        });
        return this.utils.matcherHint('.toBe') +
          '\n\n' +
          `Expected value to be (using Object.is):\n` +
          `  ${this.utils.printExpected(expected)}\n` +
          `Received:\n` +
          `  ${this.utils.printReceived(received)}` +
          (diffString ? `\n\nDifference:\n\n${diffString}` : '');
      };

    return { message, pass };
  }
});
