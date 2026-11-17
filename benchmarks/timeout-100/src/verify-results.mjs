import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { grade } from './grade.mjs';
import { sourceManifest } from './host.mjs';
import { documents, hash } from './scenario.mjs';
const file = process.argv[2];
if (!file) throw Error('Supply a public comparison JSON file');
const data = JSON.parse(await fs.readFile(file, 'utf8')),
  source = await sourceManifest();
assert.equal(data.dataset.uniqueCases, 1);
assert.equal(data.dataset.attemptsPerSetup, 1);
assert.equal(data.measurements.length, data.counts.measured);
assert.equal(
  new Set(data.measurements.map((m) => m.setupId)).size,
  data.counts.measured,
);
for (const row of data.measurements) {
  const evidence = row.evidence;
  for (const key of ['datasetHash', 'promptHash', 'catalogHash'])
    assert.equal(evidence.manifest[key], source[key]);
  const docs = documents();
  for (const event of evidence.events.filter((e) => e.kind === 'document'))
    assert.equal(event.contentHash, hash(docs[event.documentId]));
  for (const name of Object.keys(source.files).filter((n) => n !== 'grade.mjs'))
    assert.equal(
      evidence.manifest.files[name],
      source.files[name],
      `Execution source mismatch: ${name}`,
    );
  const result = grade({
    events: evidence.events,
    publicKey: evidence.manifest.publicKey,
    runId: evidence.runId,
    finalText: evidence.finalHandoff,
  });
  assert.equal(result.success, row.passed);
  assert.equal(result.quality.points, row.points);
  assert.equal(result.functionCalls, row.functionCalls);
  assert.equal(result.targetAttempts, row.targetAttempts);
  if (row.usage && row.apiEquivalentCost) {
    const u = row.usage,
      p = row.apiEquivalentCost.rates;
    const usd =
      ((u.input - (u.cachedInput ?? 0) - (u.cacheWrite ?? 0)) * p.input +
        (u.cachedInput ?? 0) * p.cache_read +
        (u.cacheWrite ?? 0) * p.cache_write +
        u.output * p.output) /
      1e6;
    assert(
      Math.abs(usd - row.apiEquivalentCost.usd) < 1e-9,
      'Cost formula mismatch',
    );
  }
}
console.log(
  JSON.stringify({
    verified: true,
    independentSetups: data.measurements.length,
    caseCount: 1,
    signatures: 'valid',
    grading: 'matches',
    priceArithmetic: 'matches',
  }),
);
