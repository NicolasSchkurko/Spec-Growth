# Security

SkillSpector (NVIDIA, Apache-2.0) static scan of the installed skill. It complements the conformance suite: that one measures behavior; this one looks for malicious patterns (prompt injection, exfiltration, privilege escalation, supply chain, excessive agency, dangerous code).

## Scan

```bash
skillspector scan <skill-dir> --no-llm   # v2.12.0
```

LLM semantic analysis was not used in this environment: the available provider (`opencode_cli`) requires OpenCode 1.18.33 and this machine runs 2.0.31. The static rule set (71 patterns, AST + YARA incl.) covers the scan below.

## Result (2026-10-18)

- **Score 32/100 — MEDIUM / CAUTION** (executable scripts apply a 1.3x multiplier).
- **No HIGH or CRITICAL findings**: no prompt injection, no data exfiltration, no credential access, no eval/exec of untrusted data, no malware signatures.

| Finding | Where | Triage |
|---|---|---|
| LP3 MCP least privilege | `SKILL.md` | **Implementation scope: weaker than it looks.** The skill declares intent, but this OpenCode build does **not enforce** agent `permissions` (measured — `quality/dispatch-smoke.mjs` had a denied edit write a file; see `references/status.md`). The compensating control is that every command that dispatches a read-only child checks `git status` / `git diff` when it returns. **Re-scan pending after v1.5** (agents + dispatch changed the surface this scan covered). |
| EA2 excessive agency | `spec-gate.md`, `gate-check.mjs` | False positive (text heuristic): the flagged lines are error messages that **require** human approval for protected files. |
| RP1 MCP rug pull | `references/init.md` | Accepted/documented: INIT now requires pinning a concrete reviewed semver and never `@latest`; the scanner still flags the `<placeholder>` because it only recognizes numeric versions. Re-check when the real version is chosen. |
| EA3 scope creep | `THIRD-PARTY-NOTICES.md` | False positive: MIT license boilerplate ("MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE"). |

## Reproduce

Install SkillSpector in an isolated venv (see its README), then scan the skill directory. Expected: MEDIUM/CAUTION with the same heuristics. After any change, re-scan and treat a **new HIGH or CRITICAL** finding as a blocker; MEDIUM heuristics should be re-triaged, not blindly baselined.
