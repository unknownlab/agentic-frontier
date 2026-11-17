import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { startServer } from '../src/server.mjs';
import { catalog } from '../src/catalog.mjs';
import { expectedArguments, agentPrompt, scenario } from '../src/scenario.mjs';
import { grade, verifyJournal } from '../src/grade.mjs';
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'timeout-100-'));
  const keys = generateKeyPairSync('ed25519');
  const runId = randomUUID();
  const { server, port } = await startServer({
    runId,
    directory,
    privateKey: keys.privateKey,
  });
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const request = async (url, options) => {
    const response = await fetch(`http://127.0.0.1:${port}` + url, options);
    return { status: response.status, data: await response.json() };
  };
  return {
    directory,
    runId,
    publicKey: keys.publicKey,
    port,
    request,
    call: (name, args = {}, retry) =>
      request('/call', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(retry ? { 'x-retry-of': retry } : {}),
        },
        body: JSON.stringify({ name, arguments: args }),
      }),
    async events() {
      return (await fs.readFile(path.join(directory, 'events.jsonl'), 'utf8'))
        .trim()
        .split('\n')
        .map((s) => JSON.parse(s));
    },
  };
}
test('100 unique schema-defined functions; initial prompt contains no answer or retry instruction', () => {
  assert.equal(catalog.length, 100);
  assert.equal(new Set(catalog.map((f) => f.name)).size, 100);
  assert.equal(
    Object.keys(
      catalog.find((f) => f.name === 'probe_gateway_path').inputSchema
        .properties,
    ).length,
    3,
  );
  assert.doesNotMatch(
    agentPrompt,
    /retry|second|timeout|probe_gateway_path|vpn_mtu|1427|1392/,
  );
  assert.deepEqual(expectedArguments(), {
    routeTableId: 1427,
    payloadBytes: 1392,
    probeCount: 9,
  });
});
test('signed reference trajectory passes; no repair operation exists', async (t) => {
  const f = await fixture(t);
  await f.request('/catalog');
  for (const id of [
    'incident-ticket',
    'network-topology',
    'diagnostic-procedure',
    'transport-policy',
  ])
    await f.request('/docs?id=' + id);
  const first = await f.call('probe_gateway_path', expectedArguments());
  assert.equal(first.status, 504);
  const second = await f.call(
    'probe_gateway_path',
    expectedArguments(),
    first.data.receiptId,
  );
  assert.equal(second.status, 200);
  assert.equal(second.data.confirmed, true);
  const events = await f.events();
  const result = grade({
    ...f,
    events,
    finalText: `${second.data.diagnosis} ${second.data.gateway} ${second.data.verificationCode}`,
  });
  assert.equal(result.success, true);
  assert.equal(result.quality.points, 100);
  assert.equal(result.targetAttempts, 2);
  for (const phrase of [
    'VPN MTU black hole',
    'vpn_mtu_blackhole',
    'VPN-MTU blackhole',
  ]) {
    const paraphrase = grade({
      ...f,
      events,
      finalText: `${phrase} on ${second.data.gateway}; ${second.data.verificationCode}`,
    });
    assert.equal(paraphrase.success, true);
    assert.equal(paraphrase.quality.points, 100);
  }
  assert.equal(verifyJournal(events, f.publicKey, f.runId), true);
  assert(
    catalog.every((fn) => !/restart|disable|repair|delete|flush/.test(fn.name)),
  );
});
test('a plausible final answer and stopping after timeout are failures, with honest partial credit', async (t) => {
  const f = await fixture(t);
  await f.request('/catalog');
  for (const id of [
    'incident-ticket',
    'network-topology',
    'diagnostic-procedure',
    'transport-policy',
  ])
    await f.request('/docs?id=' + id);
  await f.call('probe_gateway_path', expectedArguments());
  const result = grade({
    ...f,
    events: await f.events(),
    finalText: 'The server is probably down.',
  });
  assert.equal(result.success, false);
  assert.equal(result.quality.points, 60);
  assert.equal(result.checks.explicitSecondCall, false);
});
test('wrong parameters and look-alike functions cannot produce confirmed evidence', async (t) => {
  const f = await fixture(t);
  assert.equal(
    (
      await f.call('probe_gateway_path', {
        ...expectedArguments(),
        probeCount: 8,
      })
    ).status,
    422,
  );
  assert.equal(
    (await f.call('probe_gateway_path', { ...expectedArguments(), extra: 1 }))
      .status,
    422,
  );
  const preview = await f.call('preview_gateway_path');
  assert.equal(preview.data.confirmed, false);
  const result = grade({
    ...f,
    events: await f.events(),
    finalText: 'vpn_mtu_blackhole ' + scenario.gateway,
  });
  assert.equal(result.success, false);
});
test('unrelated/replayed correlations and manipulated journals are rejected', async (t) => {
  const f = await fixture(t);
  const first = await f.call('probe_gateway_path', expectedArguments());
  assert.equal(
    (await f.call('probe_gateway_path', expectedArguments(), 'fabricated'))
      .status,
    409,
  );
  await f.call('probe_gateway_path', expectedArguments(), first.data.receiptId);
  const events = await f.events();
  assert.equal(verifyJournal(events.slice(1), f.publicKey, f.runId), false);
  const forged = structuredClone(events);
  forged[0].status = 200;
  assert.equal(verifyJournal(forged, f.publicKey, f.runId), false);
  assert.equal(verifyJournal(events, f.publicKey, randomUUID()), false);
});
test('the real client never retries automatically and preserves correlation across explicit invocations', async (t) => {
  const f = await fixture(t);
  const client = await fs.readFile(
    new URL('../src/ops.mjs', import.meta.url),
    'utf8',
  );
  await fs.writeFile(path.join(f.directory, 'ops.mjs'), client);
  await fs.writeFile(
    path.join(f.directory, 'connection.json'),
    JSON.stringify({ endpoint: `http://127.0.0.1:${f.port}` }),
  );
  const invoke = () =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        path.join(f.directory, 'ops.mjs'),
        'call',
        'probe_gateway_path',
        JSON.stringify(expectedArguments()),
      ]);
      let stdout = '',
        stderr = '';
      child.stdout.on('data', (b) => (stdout += b));
      child.stderr.on('data', (b) => (stderr += b));
      child.on('error', reject);
      child.on('exit', (code) => resolve({ code, stdout, stderr }));
    });
  const first = await invoke();
  assert.equal(first.code, 124);
  assert.equal(
    (await f.events()).filter((e) => e.kind === 'function').length,
    1,
  );
  const second = await invoke();
  assert.equal(second.code, 0);
  assert.equal(JSON.parse(second.stdout).confirmed, true);
});
