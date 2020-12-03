'use strict';
/* eslint-disable no-process-env, no-process-exit */
const fs = require('fs/promises');
const { createWriteStream } = require('fs');
const path = require('path');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);
const fetch = require('node-fetch');

if (process.env.NO_UPDATE) {
  process.exit(0);
}

// We pin to specific version, and update this as the spec or tests update.
//
// To get the latest commit:
// 1. Go to https://github.com/w3c/web-platform-tests/tree/master/import-maps/data-driven/resources/
// 2. Press "y" on your keyboard to get a permalink
// 3. Copy the commit hash
const sha = '097305c27bfc7dca542014efdc1e9fda1e54ee05';

main().catch(e => {
  console.error(e.stack);
  process.exit(1);
});

const jsonDir = path.resolve(__dirname, '__tests__/json');

async function main() {
  const filesURL = `https://api.github.com/repos/web-platform-tests/wpt/contents/import-maps/data-driven/resources?ref=${sha}`;
  const filesJSON = await (await fetch(filesURL)).json();
  const files = filesJSON
    .map(entry => ({ url: entry.download_url, name: entry.name }))
    .filter(entry => path.extname(entry.name) === '.json');

  await fs.rmdir(jsonDir, { recursive: true });
  await fs.mkdir(jsonDir, { recursive: true });

  await Promise.all(files.map(saveFile));
}

async function saveFile({ url, name }) {
  const res = await fetch(url);

  const dest = path.resolve(jsonDir, name);
  const file = createWriteStream(dest);

  await pipeline(res.body, file);
}
