import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { startServer } from './server.mjs';
import { expectedArguments } from './scenario.mjs';
import { grade } from './grade.mjs';
const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'timeout-100-reference-'),
  ),
  keys = generateKeyPairSync('ed25519'),
  runId = randomUUID();
const { server, port } = await startServer({
  runId,
  directory,
  privateKey: keys.privateKey,
});
try {
  const url = `http://127.0.0.1:${port}`;
  await fetch(url + '/catalog');
  for (const id of [
    'incident-ticket',
    'network-topology',
    'diagnostic-procedure',
    'transport-policy',
  ])
    await fetch(url + '/docs?id=' + id);
  const call = (retry) =>
    fetch(url + '/call', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(retry ? { 'x-retry-of': retry } : {}),
      },
      body: JSON.stringify({
        name: 'probe_gateway_path',
        arguments: expectedArguments(),
      }),
    });
  const first = await call(),
    timeout = await first.json();
  const stopped = (
    await fs.readFile(path.join(directory, 'events.jsonl'), 'utf8')
  )
    .trim()
    .split('\n')
    .map((s) => JSON.parse(s));
  const negative = grade({
    events: stopped,
    publicKey: keys.publicKey,
    runId,
    finalText: 'The server must be down.',
  });
  const second = await call(timeout.receiptId),
    confirmed = await second.json();
  const events = (
    await fs.readFile(path.join(directory, 'events.jsonl'), 'utf8')
  )
    .trim()
    .split('\n')
    .map((s) => JSON.parse(s));
  const positive = grade({
    events,
    publicKey: keys.publicKey,
    runId,
    finalText: `${confirmed.diagnosis} ${confirmed.gateway} ${confirmed.verificationCode}`,
  });
  console.log(
    JSON.stringify(
      {
        kind: 'scripted harness controls, not agent measurements',
        firstHttpStatus: first.status,
        secondHttpStatus: second.status,
        positive: { passed: positive.success, points: positive.quality.points },
        stopAfterTimeout: {
          passed: negative.success,
          points: negative.quality.points,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise((r) => server.close(r));
  await fs.rm(directory, { recursive: true, force: true });
}
