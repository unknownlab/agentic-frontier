import { verify } from 'node:crypto';
import { expectedArguments, hash, RUBRIC, scenario } from './scenario.mjs';
export const EVALUATOR_VERSION = '1.0.1';
export function verifyJournal(events, publicKey, runId) {
  let previous = '0'.repeat(64);
  return events.every((event, index) => {
    const { signature, ...payload } = event;
    const ok =
      payload.runId === runId &&
      payload.sequence === index + 1 &&
      payload.previousHash === previous &&
      verify(
        null,
        Buffer.from(JSON.stringify(payload)),
        publicKey,
        Buffer.from(signature, 'base64'),
      );
    previous = hash(event);
    return ok;
  });
}
export function grade({
  events,
  publicKey,
  runId,
  finalText = '',
  caseData = scenario,
}) {
  // The finding is a human handoff, not an exact-match serialization test.
  const handoff = finalText.toLowerCase().replace(/[_\-\u2010-\u2015]/g, ' ');
  if (!events.length || !verifyJournal(events, publicKey, runId))
    throw Error('Missing or invalid signed service journal');
  const calls = events.filter((e) => e.kind === 'function');
  const target = calls.filter((e) => e.name === 'probe_gateway_path');
  const correct = target.filter((e) =>
    Object.entries(expectedArguments(caseData)).every(
      ([k, v]) => e.args?.[k] === v,
    ),
  );
  const timeout = correct.find((e) => e.status === 504),
    second = correct.find(
      (e) =>
        e.status === 200 &&
        e.result.confirmed &&
        e.sequence > (timeout?.sequence ?? Infinity),
    );
  const read = (id) =>
    events.some(
      (e) =>
        e.kind === 'document' &&
        e.documentId === id &&
        e.sequence < (second?.sequence ?? Infinity),
    );
  const checks = {
    catalogDiscovered: events.some((e) => e.kind === 'catalog'),
    ticketRead: read('incident-ticket'),
    topologyRead: read('network-topology'),
    procedureRead: read('diagnostic-procedure'),
    transportPolicyRead: read('transport-policy'),
    correctFunction: target.length > 0,
    threeCalculatedArguments: correct.length > 0,
    firstTimeoutObserved: !!timeout,
    explicitSecondCall: !!second,
    hiddenFindingReported:
      !!second &&
      /\bvpn\b/.test(handoff) &&
      /\bmtu\b/.test(handoff) &&
      /\bblack\s*hole\b/.test(handoff) &&
      finalText.toLowerCase().includes(second.result.gateway.toLowerCase()),
    receiptReported:
      !!second && finalText.includes(second.result.verificationCode),
    boundedAttempts: target.length <= 3,
  };
  const parts = [
    {
      id: 'discovery',
      label: 'Documentation and discovery',
      maxPoints: 15,
      points:
        3 *
        [
          checks.catalogDiscovered,
          checks.ticketRead,
          checks.topologyRead,
          checks.procedureRead,
          checks.transportPolicyRead,
        ].filter(Boolean).length,
    },
    {
      id: 'selection',
      label: 'Function and calculated arguments',
      maxPoints: 30,
      points:
        (checks.correctFunction ? 6 : 0) +
        8 *
          Object.keys(expectedArguments(caseData)).filter((k) =>
            target.some((e) => e.args?.[k] === expectedArguments(caseData)[k]),
          ).length,
    },
    {
      id: 'recovery',
      label: 'Timeout and explicit retry',
      maxPoints: 35,
      points:
        (checks.firstTimeoutObserved ? 10 : 0) +
        (checks.explicitSecondCall ? 25 : 0),
    },
    {
      id: 'handoff',
      label: 'Confirmed diagnosis and receipt',
      maxPoints: 15,
      points:
        (checks.hiddenFindingReported ? 8 : 0) +
        (checks.receiptReported ? 7 : 0),
    },
    {
      id: 'discipline',
      label: 'Bounded diagnostic attempts',
      maxPoints: 5,
      points: checks.firstTimeoutObserved && checks.boundedAttempts ? 5 : 0,
    },
  ];
  const points = parts.reduce((n, p) => n + p.points, 0);
  return {
    evaluatorVersion: EVALUATOR_VERSION,
    success:
      checks.threeCalculatedArguments &&
      checks.firstTimeoutObserved &&
      checks.explicitSecondCall &&
      checks.hiddenFindingReported &&
      checks.receiptReported &&
      checks.ticketRead &&
      checks.topologyRead &&
      checks.procedureRead &&
      checks.transportPolicyRead,
    checks,
    quality: { rubricId: RUBRIC, points, score: points / 100, parts },
    functionCalls: calls.length,
    targetAttempts: target.length,
    timeoutReceipt: timeout?.requestId ?? null,
    successReceipt: second?.requestId ?? null,
  };
}
