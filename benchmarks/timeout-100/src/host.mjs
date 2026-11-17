import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import {
  agentPrompt,
  workspaceReadme,
  scenario,
  hash,
  VERSION,
  RUBRIC,
} from './scenario.mjs';
import { catalog } from './catalog.mjs';
import { grade } from './grade.mjs';
const exec = promisify(execFile),
  source = path.dirname(fileURLToPath(import.meta.url));
export const sourceFiles = [
  'scenario.mjs',
  'catalog.mjs',
  'server.mjs',
  'ops.mjs',
  'grade.mjs',
  'host.mjs',
];
export async function sourceManifest() {
  const files = {};
  for (const name of sourceFiles)
    files[name] = hash(await fs.readFile(path.join(source, name), 'utf8'));
  let sourceCommit = null;
  try {
    const commit = (
      await exec('git', ['rev-parse', 'HEAD'], { cwd: source })
    ).stdout.trim();
    const prefix = (
      await exec('git', ['rev-parse', '--show-prefix'], { cwd: source })
    ).stdout.trim();
    let matches = true;
    for (const name of sourceFiles) {
      const original = await exec(
        'git',
        ['show', `${commit}:${prefix}${name}`],
        { cwd: source, maxBuffer: 4 * 1024 * 1024 },
      );
      if (hash(original.stdout) !== files[name]) matches = false;
    }
    if (matches) sourceCommit = commit;
  } catch {
    /* A source archive is still identified by its full content manifest. */
  }
  return {
    version: VERSION,
    rubric: RUBRIC,
    caseId: scenario.id,
    datasetHash: hash(scenario),
    promptHash: hash(agentPrompt),
    catalogHash: hash(catalog),
    sourceHash: hash(files),
    sourceCommit,
    files,
  };
}
function docker(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '',
      stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(Error('Docker fixture operation timed out'));
    }, 45000);
    child.stdout.on('data', (b) => (stdout += b));
    child.stderr.on('data', (b) => (stderr += b));
    child.once('error', reject);
    child.once('close', (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(stdout)
        : reject(
            Error('Docker fixture operation failed: ' + stderr.slice(-1000)),
          );
    });
    child.stdin.end(input);
  });
}
export async function deploy({
  container,
  runId = randomUUID(),
  deadlineMs = 420000,
}) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(container) || !/^[a-f0-9-]{36}$/.test(runId))
    throw Error('Invalid deployment identity');
  const privateDir = '/tmp/frontier-timeout-' + runId,
    workspace = '/workspace/timeout-100-' + runId;
  const keys = generateKeyPairSync('ed25519');
  const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' });
  const files = {};
  for (const name of ['scenario.mjs', 'catalog.mjs', 'server.mjs'])
    files[name] = await fs.readFile(path.join(source, name), 'utf8');
  const install = `const fs=require('fs');let s='';process.stdin.on('data',b=>s+=b);process.stdin.on('end',()=>{const p=JSON.parse(s);fs.mkdirSync(p.dir,{mode:0o700});for(const [name,text]of Object.entries(p.files))fs.writeFileSync(p.dir+'/'+name,text,{mode:0o600});fs.writeFileSync(p.dir+'/config.json',JSON.stringify(p.config),{mode:0o600});});`;
  await docker(
    ['exec', '-i', '--user', '0', container, 'node', '-e', install],
    JSON.stringify({
      dir: privateDir,
      files,
      config: { runId, privateKey, directory: privateDir, deadlineMs },
    }),
  );
  await docker([
    'exec',
    '--detach',
    '--user',
    '0',
    container,
    'node',
    privateDir + '/server.mjs',
    privateDir + '/config.json',
  ]);
  let ready;
  for (let n = 0; n < 40; n++) {
    try {
      ready = JSON.parse(
        await docker([
          'exec',
          '--user',
          '0',
          container,
          'cat',
          privateDir + '/ready.json',
        ]),
      );
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (!ready) throw Error('Private diagnostic service did not start');
  const client = await fs.readFile(path.join(source, 'ops.mjs'), 'utf8');
  const write = `const fs=require('fs');let s='';process.stdin.on('data',b=>s+=b);process.stdin.on('end',()=>{if(process.getuid()===0)throw Error('Agent must not run as root');const p=JSON.parse(s);try{fs.readFileSync(p.secret);throw Error('Private evaluator is readable')}catch(e){if(e.code!=='EACCES')throw e}fs.mkdirSync(p.workspace,{mode:0o700});for(const [name,text]of Object.entries(p.files))fs.writeFileSync(p.workspace+'/'+name,text,{mode:0o400});});`;
  const endpoint = 'http://127.0.0.1:' + ready.port;
  await docker(
    ['exec', '-i', container, 'node', '-e', write],
    JSON.stringify({
      workspace,
      secret: privateDir + '/config.json',
      files: {
        'ops.mjs': client,
        'README.md': workspaceReadme,
        'connection.json': JSON.stringify({ endpoint }),
      },
    }),
  );
  const image = (
    await exec('docker', ['inspect', container, '--format', '{{.Image}}'])
  ).stdout.trim();
  const manifest = {
    ...(await sourceManifest()),
    runId,
    publicKey,
    image,
    transport: 'cli-over-local-http',
    functionCount: 100,
    timeoutPolicy:
      'first valid diagnostic attempt returns HTTP 504; explicit correlated retry returns confirmed evidence',
    deadlineMs,
  };
  return {
    runId,
    workspace,
    endpoint,
    manifest,
    async inspect(finalText) {
      const raw = await docker([
        'exec',
        '--user',
        '0',
        container,
        'cat',
        privateDir + '/events.jsonl',
      ]);
      const events = raw
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((s) => JSON.parse(s));
      return { events, ...grade({ events, publicKey, runId, finalText }) };
    },
    async close() {
      await docker([
        'exec',
        '--user',
        '0',
        container,
        'node',
        '-e',
        `const fs=require('fs');const p=process.argv[1];try{const s=JSON.parse(fs.readFileSync(p+'/ready.json','utf8'));try{process.kill(s.pid,'SIGTERM')}catch{}}finally{fs.rmSync(p,{recursive:true,force:true});}`,
        privateDir,
      ]);
    },
  };
}
