const integer = { type: 'integer', minimum: 1 };
const object = (properties = {}, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const families = {
  gateway: [
    'get_gateway_inventory',
    'get_gateway_health',
    'get_gateway_routes',
    'get_gateway_counters',
    'get_gateway_latency',
    'get_gateway_errors',
    'get_gateway_neighbors',
    'get_gateway_firmware',
    'get_gateway_uptime',
    'get_gateway_capacity',
  ],
  vpn: [
    'get_vpn_inventory',
    'get_vpn_sessions',
    'get_vpn_route_status',
    'get_vpn_policy',
    'get_vpn_peer_health',
    'get_vpn_mtu_summary',
    'get_vpn_tunnel_counters',
    'get_vpn_handshakes',
    'get_vpn_cipher_status',
    'get_vpn_route_preview',
  ],
  replication: [
    'get_replication_health',
    'get_replication_lag',
    'get_replication_topology',
    'get_replication_offsets',
    'get_replication_workers',
    'get_replication_backlog',
    'get_replication_checkpoint',
    'get_replication_schedule',
    'get_replication_errors',
    'get_replication_preview',
  ],
  database: [
    'get_database_health',
    'get_database_connections',
    'get_database_locks',
    'get_database_replication',
    'get_database_query_stats',
    'get_database_storage',
    'get_database_transactions',
    'get_database_backup_status',
    'get_database_schema_version',
    'get_database_checkpoint',
  ],
  queue: [
    'get_queue_health',
    'get_queue_depth',
    'get_queue_consumers',
    'get_queue_partitions',
    'get_queue_offsets',
    'get_queue_retention',
    'get_queue_deadletters',
    'get_queue_throughput',
    'get_queue_latency',
    'get_queue_delivery_stats',
  ],
  dns: [
    'get_dns_health',
    'get_dns_records',
    'get_dns_resolver_status',
    'get_dns_ttl',
    'get_dns_cache_stats',
    'get_dns_failures',
    'get_dns_authority',
    'get_dns_latency',
    'get_dns_zone_version',
    'get_dns_forwarders',
  ],
  tls: [
    'get_tls_health',
    'get_tls_certificate',
    'get_tls_expiry',
    'get_tls_protocols',
    'get_tls_handshake_stats',
    'get_tls_cipher_policy',
    'get_tls_trust_roots',
    'get_tls_session_cache',
    'get_tls_renegotiations',
    'get_tls_peer_identity',
  ],
  loadbalancer: [
    'get_loadbalancer_health',
    'get_loadbalancer_backends',
    'get_loadbalancer_routes',
    'get_loadbalancer_connections',
    'get_loadbalancer_error_stats',
    'get_loadbalancer_timeouts',
    'get_loadbalancer_policy',
    'get_loadbalancer_capacity',
    'get_loadbalancer_latency',
    'get_loadbalancer_weights',
  ],
  host: [
    'get_host_health',
    'get_host_cpu',
    'get_host_memory',
    'get_host_disk',
    'get_host_network',
    'get_host_processes',
    'get_host_clock',
    'get_host_limits',
    'get_host_boot_id',
    'get_host_file_handles',
  ],
  diagnostics: [
    'probe_gateway_path',
    'preview_gateway_path',
    'probe_server_port',
    'probe_dns_resolution',
    'probe_tls_handshake',
    'probe_queue_delivery',
    'probe_database_read',
    'probe_replication_preview',
    'get_diagnostic_history',
    'get_diagnostic_capabilities',
  ],
};
export const catalog = Object.entries(families).flatMap(([domain, names]) =>
  names.map((name) => ({
    name,
    domain,
    description:
      name === 'probe_gateway_path'
        ? 'Run the approved, read-only gateway-path diagnostic. Derive its parameters from operating documentation. A confirmed result includes diagnostic evidence.'
        : `Read-only ${domain} ${name.replace(/^(get|probe|preview)_/, '').replaceAll('_', ' ')}. Summaries and previews are not a confirmed gateway-path diagnostic.`,
    inputSchema:
      name === 'probe_gateway_path'
        ? object({
            routeTableId: integer,
            payloadBytes: integer,
            probeCount: integer,
          })
        : object(),
  })),
);
if (catalog.length !== 100 || new Set(catalog.map((f) => f.name)).size !== 100)
  throw Error('Catalog must contain exactly 100 unique functions');
export function validArguments(schema, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return false;
  if (Object.keys(args).some((k) => !Object.hasOwn(schema.properties, k)))
    return false;
  return schema.required.every(
    (k) => Number.isSafeInteger(args[k]) && args[k] >= 1,
  );
}
