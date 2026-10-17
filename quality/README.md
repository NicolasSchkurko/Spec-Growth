# Quality — how this system is measured

Everything in this folder exists to answer one question: **does the system (still) work?** It is not installed into user repositories; it lives here as the evidence behind the token diet and the v1.2 restructure.

| Path | What it is |
|---|---|
| [`conformance/`](conformance/README.md) | The frozen conformance suite: anchor tasks run against the real agent, mechanical checkers plus a cross-family LLM judge |
| [`conformance/BASELINE.md`](conformance/BASELINE.md) | The starting point (2026-10-16): per-rule pass rates and token usage, frozen for comparison |
| [`conformance/DIET-T1.md`](conformance/DIET-T1.md) | Results of the token diet and the v1.2 restructure, measured against the baseline |
| [`conformance/summary.md`](conformance/summary.md) | Generated: latest behavior results per task |
| [`conformance/tokens.md`](conformance/tokens.md) | Generated: per-run token usage |
| [`RESTRUCTURE.md`](RESTRUCTURE.md) | The v1.2 plan: subagent routing and progressive disclosure (skill packaging) |

**The rule for any change to the skill:** re-run the frozen suite and compare. The bar is *equal or better* on every rule — a change that lowers tokens but breaks a rule is a regression, not an optimization.
