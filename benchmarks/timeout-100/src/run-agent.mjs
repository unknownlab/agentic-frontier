import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { deploy } from './host.mjs';
import { agentPrompt } from './scenario.mjs';
import { finalHandoff } from './final-handoff.mjs';
const [container, commandJson, outputDir = 'results/local'] =
  process.argv.slice(2);
if (!container || !commandJson) {
  console.error(
    'Usage: node src/run-agent.mjs <running-nonroot-container> <JSON argv with $PROMPT> [output-dir]',
  );
  process.exit(64);
}
const command = JSON.parse(commandJson);
if (
  !Array.isArray(command) ||
  !command.length ||
  command.some((x) => typeof x !== 'string') ||
  !command.includes('$PROMPT')
)
  throw Error('Supply a native CLI argv array containing a $PROMPT element');
const d = await deploy({ container });
try {
  const prompt = agentPrompt + '\n\nWorkspace: ' + d.workspace;
  const started = performance.now();
  const execution = await new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'exec',
        '--workdir',
        d.workspace,
        container,
        ...command.map((v) => (v === '$PROMPT' ? prompt : v)),
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '',
      stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, 240000);
    child.stdout.on('data', (b) => (stdout += b));
    child.stderr.on('data', (b) => (stderr += b));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut, stdout, stderr });
    });
  });
  const result = await d.inspect(finalHandoff(execution.stdout));
  const dir = path.resolve(outputDir, d.runId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await fs.writeFile(
    path.join(dir, 'result.json'),
    JSON.stringify(
      {
        manifest: d.manifest,
        execution: {
          exitCode: execution.code,
          timedOut: execution.timedOut,
          latencyMs: performance.now() - started,
        },
        ...result,
      },
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  );
  await fs.writeFile(path.join(dir, 'native-output.txt'), execution.stdout, {
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      resultDirectory: dir,
      success: result.success,
      points: result.quality.points,
      targetAttempts: result.targetAttempts,
    }),
  );
} finally {
  await d.close();
}
