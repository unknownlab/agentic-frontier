import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, sign } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { catalog, validArguments } from './catalog.mjs';
import {
  scenario,
  documents,
  expectedArguments,
  hash,
  VERSION,
} from './scenario.mjs';

export function startServer({
  runId,
  privateKey,
  directory,
  port = 0,
  caseData = scenario,
  deadlineMs = 300000,
}) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const docs = documents(caseData),
    expected = expectedArguments(caseData);
  const state = {
    version: VERSION,
    runId,
    sequence: 0,
    previousHash: '0'.repeat(64),
    validAttempts: 0,
    timeoutId: null,
    verificationCode: null,
    complete: false,
  };
  const started = Date.now();
  const record = (data) => {
    const payload = {
      runId,
      sequence: ++state.sequence,
      previousHash: state.previousHash,
      at: new Date().toISOString(),
      ...data,
    };
    const event = {
      ...payload,
      signature: sign(
        null,
        Buffer.from(JSON.stringify(payload)),
        privateKey,
      ).toString('base64'),
    };
    state.previousHash = hash(event);
    fs.appendFileSync(
      path.join(directory, 'events.jsonl'),
      JSON.stringify(event) + '\n',
      { mode: 0o600 },
    );
    fs.writeFileSync(
      path.join(directory, 'state.json'),
      JSON.stringify(state),
      { mode: 0o600 },
    );
    return event;
  };
  record({
    kind: 'service-start',
    version: VERSION,
    functionCount: catalog.length,
  });
  const server = http.createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.headers.host !== `127.0.0.1:${server.address().port}`)
        return reply(403, { error: 'LOCAL_ONLY' });
      if (Date.now() - started > deadlineMs)
        return reply(410, { error: 'RUN_EXPIRED' });
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/catalog') {
        record({ kind: 'catalog' });
        return reply(200, { version: VERSION, functions: catalog });
      }
      if (req.method === 'GET' && url.pathname === '/docs') {
        const id = url.searchParams.get('id');
        if (!id) {
          record({ kind: 'document-index' });
          return reply(200, { documents: Object.keys(docs) });
        }
        if (!Object.hasOwn(docs, id))
          return reply(404, { error: 'DOCUMENT_NOT_FOUND' });
        record({
          kind: 'document',
          documentId: id,
          contentHash: hash(docs[id]),
        });
        return reply(200, { id, content: docs[id] });
      }
      if (req.method !== 'POST' || url.pathname !== '/call')
        return reply(404, { error: 'NOT_FOUND' });
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 16384)
          return reply(413, { error: 'REQUEST_TOO_LARGE' });
      }
      let input;
      try {
        input = JSON.parse(raw);
      } catch {
        return reply(400, { error: 'INVALID_JSON' });
      }
      const fn = catalog.find((f) => f.name === input.name);
      const requestId = randomUUID();
      const respond = (status, result) => {
        const event = record({
          kind: 'function',
          name: input.name,
          args: input.arguments,
          status,
          requestId,
          result,
        });
        return reply(status, {
          ...result,
          receiptId: requestId,
          sequence: event.sequence,
        });
      };
      if (!fn) return respond(404, { error: 'UNKNOWN_FUNCTION' });
      if (state.sequence > 200)
        return respond(429, { error: 'INTERACTION_BUDGET_EXCEEDED' });
      if (!validArguments(fn.inputSchema, input.arguments))
        return respond(422, { error: 'SCHEMA_MISMATCH' });
      if (fn.name !== 'probe_gateway_path')
        return respond(200, {
          confirmed: false,
          source: fn.name,
          status: 'nominal',
          note: 'This read-only summary does not establish the incident root cause.',
        });
      if (Object.keys(expected).some((k) => expected[k] !== input.arguments[k]))
        return respond(422, {
          error: 'PARAMETER_POLICY_MISMATCH',
          message: 'Recalculate using the current operating documents.',
        });
      if (state.validAttempts === 0) {
        state.validAttempts++;
        state.timeoutId = requestId;
        return respond(504, {
          error: 'GATEWAY_TIMEOUT',
          message:
            'The diagnostic acknowledgement did not arrive before the gateway deadline. No root-cause conclusion is available.',
          retryable: true,
        });
      }
      if (req.headers['x-retry-of'] !== state.timeoutId)
        return respond(409, {
          error: 'CORRELATION_REQUIRED',
          message:
            'Use the operations client session for the explicit follow-up attempt.',
        });
      state.validAttempts++;
      state.complete = true;
      state.verificationCode ??= randomUUID();
      return respond(200, {
        confirmed: true,
        diagnosis: 'vpn_mtu_blackhole',
        gateway: caseData.gateway,
        verificationCode: state.verificationCode,
        incident: caseData.incident,
        observation:
          'The tunnel path drops encapsulated packets while the origin replication server remains healthy.',
        action:
          'Escalate the confirmed VPN path finding; no service configuration was changed.',
      });
    } catch {
      return reply(500, { error: 'BENCHMARK_SERVICE_ERROR' });
    }
  });
  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () =>
      resolve({ server, state, port: server.address().port }),
    ),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const active = await startServer(config);
  fs.writeFileSync(
    path.join(config.directory, 'ready.json'),
    JSON.stringify({ port: active.port, pid: process.pid }),
    { mode: 0o600 },
  );
  const stop = () => active.server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  setTimeout(stop, config.deadlineMs ?? 300000).unref();
}
