#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const base = path.dirname(fileURLToPath(import.meta.url));
const [command, ...args] = process.argv.slice(2);
if (!command || command === 'help' || command === '--help') {
  console.log(
    'Operations console (one HTTP attempt per invocation)\nnode ops.mjs functions [search]\nnode ops.mjs docs [document-id]\nnode ops.mjs call <function-name> \'{"parameter":123}\'\nConnection and request correlation are managed locally.',
  );
  process.exit(0);
}
try {
  const config = JSON.parse(
    fs.readFileSync(path.join(base, 'connection.json'), 'utf8'),
  );
  let url,
    options = {};
  if (command === 'functions') url = '/catalog';
  else if (command === 'docs')
    url = '/docs' + (args[0] ? '?id=' + encodeURIComponent(args[0]) : '');
  else if (command === 'call') {
    if (args.length !== 2)
      throw Error('call requires a function name and one JSON object');
    let session = {};
    try {
      session = JSON.parse(
        fs.readFileSync(path.join(base, '.ops-session.json'), 'utf8'),
      );
    } catch {}
    url = '/call';
    options = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(session.retryOf ? { 'x-retry-of': session.retryOf } : {}),
      },
      body: JSON.stringify({ name: args[0], arguments: JSON.parse(args[1]) }),
    };
  } else throw Error('Unknown console command. Use help.');
  const response = await fetch(config.endpoint + url, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  let result = await response.json();
  if (response.status === 504 && result.receiptId)
    fs.writeFileSync(
      path.join(base, '.ops-session.json'),
      JSON.stringify({ retryOf: result.receiptId }),
      { mode: 0o600 },
    );
  if (command === 'functions' && args[0])
    result = {
      ...result,
      functions: result.functions.filter((f) =>
        (f.name + ' ' + f.description).includes(args[0]),
      ),
    };
  (response.ok ? console.log : console.error)(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = response.status === 504 ? 124 : 1;
} catch (error) {
  console.error(
    JSON.stringify({ error: 'CLIENT_ERROR', message: error.message }),
  );
  process.exitCode = 1;
}
