# Timeout-100

A reproducible, black-box benchmark for function discovery, documentation-grounded argument calculation, and recovery from an ambiguous diagnostic timeout.

An agent receives one warehouse replication incident and a local operations console exposing **100 read-only functions**. It must discover operating documents, calculate three integer arguments, choose the correct diagnostic function, and obtain confirmed evidence. The first valid diagnostic call returns HTTP 504. A later explicit call with the same arguments returns the otherwise unavailable VPN-path finding and a fresh verification code. **No service repair is required. The client never retries automatically.**

This package has no npm dependencies and can be used independently of Mastra. It requires Node.js 22 or newer. The agent-facing transport is a CLI over a private local HTTP API. It measures function discovery through that console, not 100 simultaneous native LLM tool definitions.

## Reproduce the evaluator

```sh
cd benchmarks/timeout-100
node --test test/*.test.mjs
node src/reference.mjs
```

The reference program is an explicitly scripted evaluator control, not a model result. It demonstrates a 100-point successful trajectory and a failing 60-point trajectory that stops after the timeout. Tests cover schema errors, look-alike functions, forged/replayed receipts, cross-run isolation, and the client's lack of automatic retries.

## Run your own agent

Provide a running Docker container with a non-root default user, Node.js, a writable `/workspace`, and your authenticated native agent CLI. The evaluator runs as a separate root process inside that container, with root-only files under `/tmp`. The agent receives only a generic client and the local connection address. Deployment checks that the agent cannot read the evaluator configuration. The harness needs Docker operator access; the agent must not have Docker-socket access or privilege escalation.

For an already authenticated Codex container:

```sh
node src/run-agent.mjs YOUR_CONTAINER \
  '["codex","exec","--json","--sandbox","workspace-write","--","$PROMPT"]' \
  results/local
```

Arguments are passed as argv, without shell evaluation. Do not include tokens or credentials in the command. Other native CLIs can supply their own argv template. The four-minute native-agent budget and seven-minute fixture lifetime are fixed for this version. The host runner saves signed events, the public verification key, source hashes, image identity, and a result. It does not infer token usage or price from text; the Mastra adapter records native usage separately.

The standalone runner terminates its Docker client on timeout; operators should also inspect and stop any agent processes their CLI leaves running. Mastra uses its native adapter's cancellation and workspace lock. Do not reuse a container concurrently across trials.

## Agent information boundary

The initial task describes the incident and requests a confirmed diagnostic handoff. It does **not** name the target operation, expose expected arguments, disclose the VPN finding, or instruct the agent to call twice. The workspace README describes how to discover the console and documents. The current runbook explains idempotency and timeout handling; the topology and procedure contain the calculation inputs. An archived, conflicting server playbook tests whether the agent follows the current incident's read-only scope.

The answer key, service state, signing key, and grader are not mounted in the agent workspace. Each run has a private service, correlation receipt, signing key, and verification code. Server-side events are chained and signed with Ed25519. The evaluator grades those events and the actual final handoff, not a self-reported score or a forged console transcript.

Publication reveals the benchmark design and oracle. This is an open, reproducible task, not a claim that the task remains secret after release. The deployment boundary prevents direct inspection of the running oracle; it does not provide a hardened multi-tenant security boundary against an operator with Docker/root access.

## Scoring and acceptance

| Category                                                    | Maximum |
| ----------------------------------------------------------- | ------: |
| Documentation and discovery                                 |      15 |
| Function selection and calculated arguments                 |      30 |
| Observed timeout and explicit correlated retry              |      35 |
| Confirmed diagnosis, gateway, and verification-code handoff |      15 |
| Bounded diagnostic attempts                                 |       5 |

Acceptance requires the required operating documents, a valid first timeout, a confirmed subsequent call with the correct three arguments, and a final handoff containing the returned diagnosis, gateway, and verification code. Partial points do not imply acceptance. An invalid service journal is an evaluator error, not a zero-quality model result. A valid journal with no agent actions is an agent failure.

All 100 operations are real dispatchable service functions with validated schemas. Most are deterministic health/inventory/preview fixtures; they are distractors, not integrations with live infrastructure. Only the approved deep diagnostic can establish the incident finding. The forced timeout is a deterministic HTTP error response, not an uncontrolled delay or a real VPN outage.

## Comparing agents

Use **one dataset containing this one frozen incident for every setup**, with fresh service state and an independent agent execution for each trial. Hold the task, source hash, rubric, CLI transport, and time budget constant. Record the actual model, CLI/harness version, container image, pass/fail, category scores, function-call count, latency, and reported usage. Configurations using different models compare complete setups; they cannot isolate a harness effect.

The initial comparison is one attempt per setup. It demonstrates integration behavior on one task, not a statistically reliable general capability ranking. Do not interpret internal checks or repeated grading as additional independent tasks. Report setup/authentication errors and missing usage explicitly. API-equivalent cost is a rate-based comparison, not a ChatGPT subscription invoice; unreported child-agent usage remains uncounted.

In the parent project, **Mastra Studio → Experiment Board → Playground → Black-box incident investigation** launches native experiments and displays results, costs, latency, signed function evidence, and partial scores. The shared dataset is `timeout-100-v1`; workflow `timeout100Test`; scorer `timeout-100-quality-v1`. Mastra/Studio vendor code is unchanged.

## Immutable source and publication

Link to a full commit SHA, not `main`:

```text
https://github.com/unknownlab/agentic-frontier/tree/FULL_COMMIT_SHA/benchmarks/timeout-100
```

Every run records SHA-256 hashes for the case, base prompt, function catalog, and runtime source files. When all runtime files match a committed revision, its full commit SHA is also recorded. A later code change must create a new dataset version; the Mastra workflow refuses to execute a pinned dataset against a different source hash.

Keep published result snapshots separate from live dashboards. A commit containing a result snapshot can link back to the benchmark source revision used for that run. A source permalink freezes code, not model-provider behavior, future subscription limits, or model outputs. Review result exports before publishing; never include native authentication stores or raw credential material.

See [GitHub's permalink documentation](https://docs.github.com/en/repositories/working-with-files/using-files/getting-permanent-links-to-files). There is no “best agent” claim from this single-task comparison.
