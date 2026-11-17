# Timeout-100 initial comparison

One shared incident × 19 setups × one fresh attempt. **19 passed; 0 failed.** Both unsupported candidates are listed in the JSON snapshot.

Reported usage: **3,751,468 tokens**. API-equivalent total: **$2.0190**.

All setups tied on this task’s quality score. Cost ordering describes these individual runs; it establishes no general best agent. The observed models differ.

| Setup | Reported model | Points | Target attempts | Tokens | API-equivalent USD | Native latency |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Pi | gpt-6.1-sol | 100 | 2 | 46,275 | $0.0323 | 28.5 s |
| Cline CLI · ChatGPT | gpt-6.1-sol | 100 | 2 | 42,789 | $0.0387 | 39.7 s |
| Codex + Software Factory | gpt-6.2-sol | 100 | 2 | 164,557 | $0.0524 | 29.1 s |
| Codex | gpt-6.2-sol | 100 | 2 | 168,875 | $0.0532 | 25.1 s |
| OpenCode | gpt-6.1-sol | 100 | 2 | 116,604 | $0.0547 | 49.2 s |
| Oh My Pi | gpt-6.1-sol | 100 | 2 | 147,908 | $0.0567 | 56.9 s |
| Codex + Harness Generator | gpt-6.2-sol | 100 | 2 | 195,571 | $0.0655 | 34.3 s |
| Codex + BMAD | gpt-6.2-sol | 100 | 2 | 200,124 | $0.0668 | 30.2 s |
| Codex + Spec Kit | gpt-6.2-sol | 100 | 2 | 168,312 | $0.0715 | 33.6 s |
| Goose + Codex ACP | gpt-6.2-sol | 100 | 2 | 153,183 | $0.0739 | 27.1 s |
| Codex + OpenSpec | gpt-6.2-sol | 100 | 2 | 210,046 | $0.0779 | 34.8 s |
| GSD Pi · ChatGPT | gpt-6.1-sol | 100 | 2 | 321,896 | $0.0902 | 40.8 s |
| OpenCode + OmO | gpt-6.1-sol | 100 | 2 | 184,819 | $0.0915 | 41.7 s |
| Codex + GSD Core | gpt-6.2-sol | 100 | 2 | 229,496 | $0.0922 | 40.8 s |
| Kilo CLI · ChatGPT | gpt-6.1-sol | 100 | 2 | 227,131 | $0.1063 | 89.3 s |
| Codex + Superpowers | gpt-6.2-sol | 100 | 2 | 205,337 | $0.1160 | 32.3 s |
| Hermes · ChatGPT | gpt-6.1-sol | 100 | 2 | 220,712 | $0.1231 | 66.3 s |
| OmO Native · ChatGPT | gpt-6.1-sol | 100 | 2 | 493,493 | $0.1293 | 93.2 s |
| Codex + OmO Light | gpt-6-astra | 100 | 2 | 254,340 | $0.6268 | 54.3 s |

The evaluator’s exact-code handoff defect was corrected consistently from saved, signed evidence. Original prototype reports are preserved. The five 92-point prototype grades were grader errors, not model failures. No new attempts were counted for the correction.

The snapshot includes signed service journals and public verification keys. It excludes native authentication stores and VPN configuration. See `first-comparison.json` for category scores, provenance, skipped setups, price rates, limitations, and complete evidence.

Verify the snapshot from this package:

```sh
node src/verify-results.mjs results/first-comparison.json
```

Pinned sources: [execution protocol](https://github.com/unknownlab/agentic-frontier/tree/0381fcc4e7d8debad73feaf7f1e05f86d79ac327/benchmarks/timeout-100) · [corrected evaluator](https://github.com/unknownlab/agentic-frontier/tree/f27b1d9fed9b32478857d5284789cc8366212e3a/benchmarks/timeout-100).
