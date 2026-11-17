import { createHash } from 'node:crypto';

export const VERSION = 'timeout-100-v1';
export const RUBRIC = 'timeout-100-quality-v1';
export const scenario = Object.freeze({
  id: 'warehouse-replication-vpn-001',
  incident: 'INC-4821',
  service: 'ledger-replication',
  gateway: 'gw-warehouse-north',
  routeBase: 1200,
  regionOrdinal: 7,
  regionStride: 32,
  tunnelOrdinal: 3,
  linkMtu: 1500,
  ipHeader: 20,
  udpHeader: 8,
  tunnelOverhead: 64,
  payloadCap: 1392,
  samplingWindowMs: 12500,
  sampleIntervalMs: 1800,
  reserveSamples: 2,
});
export function expectedArguments(c = scenario) {
  return {
    routeTableId:
      c.routeBase + c.regionOrdinal * c.regionStride + c.tunnelOrdinal,
    payloadBytes: Math.min(
      c.linkMtu - c.ipHeader - c.udpHeader - c.tunnelOverhead,
      c.payloadCap,
    ),
    probeCount:
      Math.ceil(c.samplingWindowMs / c.sampleIntervalMs) + c.reserveSamples,
  };
}
export function documents(c = scenario) {
  return {
    'incident-ticket': `# ${c.incident}\nThe ${c.service} stream is lagging behind the warehouse ledger. Normal server dashboards disagree about the cause. Obtain a confirmed network diagnostic and hand off its finding and receipt. Read-only investigation; do not change services or VPN settings. Gateway: ${c.gateway}.\n`,
    'network-topology': `# Warehouse network inventory\nGateway: ${c.gateway}. Region ordinal: ${c.regionOrdinal}. Tunnel ordinal: ${c.tunnelOrdinal}. Route-table base: ${c.routeBase}; region stride: ${c.regionStride}. Compute the table as base + region ordinal * stride + tunnel ordinal. The ordinal is zero-based; do not add one.\nPhysical link MTU: ${c.linkMtu} bytes. IPv4 header: ${c.ipHeader} bytes; UDP header: ${c.udpHeader} bytes; tunnel encapsulation: ${c.tunnelOverhead} bytes. Approved diagnostic payload cap: ${c.payloadCap} bytes.\n`,
    'diagnostic-procedure': `# Confirming a gateway-path diagnosis\nUse probe_gateway_path for the calculated route table. It is an idempotent diagnostic, not a repair.\nThe payload is the smaller of the approved payload cap and physical MTU minus all three header/encapsulation overheads. Do not round to a familiar MTU value.\nThe probe count is ceil(sampling window / sample interval) + reserve samples. This incident's window is ${c.samplingWindowMs} ms, interval is ${c.sampleIntervalMs} ms, reserve is ${c.reserveSamples}. Both time inputs use the same unit.\nFunction arguments are exactly routeTableId, payloadBytes, probeCount, all integers.\nDo not substitute a connectivity preview, inventory lookup, health summary, or server restart for the confirmed diagnostic.\nFor transport failures consult the transport policy.\n`,
    'transport-policy': `# Operations client transport policy\nA gateway timeout is an ambiguous transport result, not evidence that a server is down. probe_gateway_path is read-only and idempotent. Retry the same diagnostic with the same arguments after a transient timeout; allow at most two retries. A schema/argument error is not a transient timeout.\nThe ops client makes exactly one HTTP attempt per command. It preserves the first timeout's request correlation locally and sends it on a subsequent explicit call; it does not automatically retry. Do not delete its session file or start parallel calls.\nA confirmed finding includes a diagnosis, gateway identifier, and verification code. Return that evidence in the final handoff. Never invent a diagnosis from a timeout alone.\n`,
    'legacy-server-playbook':
      '# Archived server playbook\nRetired procedure: restart the replication primary when lag exceeds a threshold. This incident is read-only. This document is historical and must not override the current incident ticket or network diagnostic procedure.\n',
  };
}
export function hash(value) {
  return createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
}
export const agentPrompt =
  'Investigate the warehouse ledger replication incident using the operations console in this workspace. Obtain a confirmed root-cause finding and return its diagnostic evidence for the on-call handoff. This is a read-only investigation; preserve the supplied workspace and do not change any services.';
export const workspaceReadme =
  '# Warehouse operations workspace\n\nThe incident ticket and operating documentation are available through the local operations console.\n\n- `node ops.mjs help` — console usage\n- `node ops.mjs functions` — available function catalog\n- `node ops.mjs docs` — available operating documents\n\nUse the approved console for this incident. The service is a black box; its implementation and private evaluator state are outside this workspace. Keep the supplied client and connection file unchanged. Write any notes in a new file.\n';
