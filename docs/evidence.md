# Evidence base & known limits

Spec Growth's **comprehension mechanisms** (v1.0: tech brief, teach-back, expressivity rules, `/spec-explain`) are grounded in recent GenAI-assisted software-engineering research. The rest of the system — gates, states, approvals, audit rounds — comes from engineering practice, hardened through adversarial audit rounds (v0.5 → v1.0).

This page records **what each mechanism is based on**, what transfers (and what does not), and the **consolidated known limits** of the system. We only cite sources verified when written (arXiv IDs resolve; the described finding matches the abstract).

## Research base → what it caused here

| Source | Finding | Mechanism in Spec Growth |
|---|---|---|
| Ahmad 2026, *Comprehension Debt in GenAI-Assisted Software Engineering Projects* (EASE 2026 · [arXiv:2604.13277](https://arxiv.org/abs/2604.13277)) | 621 reflective diaries from 207 students: comprehension debt accumulates even when the code is clean and the tests are green; four accumulation patterns — black-box acceptance, context mismatch, dependency-induced atrophy, **verification bypass** | The premise: machine-green ≠ understood. The walkthrough + comprehension sign-off ritual; the gate never equates `verified` with "understood" |
| Sankaranarayanan 2026, *Mitigating "Epistemic Debt" in GenAI-Scaffolded Programming* ([arXiv:2602.20206](https://arxiv.org/abs/2602.20206)) | Controlled experiment (N=78): unrestricted AI and scaffolded AI tie on speed, but unrestricted users fail **77% vs 39%** on a later maintenance task; the winning condition was an **Explanation Gate** (teach-back before integrating generated code) | The teach-back in `/spec-verify`: free recall, the agent validates against the real code (`file:line`), corrects misconceptions, max 2 rounds — only then the sign-off is recorded |
| Shen & Tamkin 2026, *How AI Impacts Skill Formation* ([arXiv:2601.20245](https://arxiv.org/abs/2601.20245)) | RCT (52 engineers, a new library): passive delegation impairs conceptual understanding, code reading and debugging (~17-point drop in the follow-up comprehension quiz, 50% vs 67%), while active, question-driven use preserves learning | Passive approval is not the path: the system pushes *consultation* — `/spec-explain` for existing code, interactive questions at apply/verify, "the human decides" at every gate |
| Saha et al. 2026, *Cognitive-Load-Aware Automated Refactoring* (EASE 2026 · [arXiv:2603.16791](https://arxiv.org/abs/2603.16791)) | Cognitively guided refactoring cut refactoring failures by **54–71%** and improved novice comprehension (function identification +31.3%, structural readability +22.0%) | The expressivity rules (semantic wrapping at physical boundaries, boundary header comments, no premature abstraction) and `/spec-explain` proposing a `kind: refactor` when code is opaque |
| Ye et al. 2026, *Readability Issues in LLM-Generated Code* ([arXiv:2605.13280](https://arxiv.org/abs/2605.13280)) | 2,735 scenarios: LLM code hides latent readability debt — excessive complexity, redundant comments, **unknown-API usage**; prompt constraints help but have a ceiling | The **Touched APIs** walkthrough section (every new API explained in 1–2 lines), the anti-noise comment policy, and the opacity audit (code → text) in `/spec-verify` |
| Osmani 2026, *Comprehension Debt* ([blog](https://addyosmani.com/blog/comprehension-debt/)) | Translating a spec to code involves dozens of implicit decisions no test captures; "tests are necessary, not sufficient"; the comprehension work is the job | The walkthrough targets the *implemented mechanism* (not more spec prose) and records **implicit decisions**; the spec stays the contract |

## Caveats (what does NOT transfer)

- **Populations**: the strongest results come from studies with students/novices (Ahmad: 207 students; Sankaranarayanan: novice "vibe coders"; CDDRefactorER: novice programmers). The *mechanisms* transfer; the *effect sizes* should not be read as production-team guarantees.
- **Qualitative vs experimental**: Ahmad is a qualitative study of accumulated debt — treat it as the problem statement, not a measured effect.
- **The interaction is the product**: the studies support *conversation* (teach-back, question-driven use), not checkboxes. Spec Growth implements the ritual minimally; if the teach-back ever becomes a rubber stamp, the mechanism is being defeated by design.
- **The gate verifies the ritual, not the understanding**: it can check that a walkthrough exists, is complete and is signed — it cannot check that you actually understood. That is a documented limit (below), not a hidden one.

## Known limits (consolidated)

| Limit | Status / Mitigation |
|---|---|
| Evidence is local, per-clone and unsigned | By design; the barrier that counts is CI running `--run-tests`. Tamper-proof signing was deliberately rejected (single-dev) |
| Freshness is a content fingerprint with caps (5,000 files; targets starting with a wildcard fall back to commit timestamps) | Degrades to timestamps and says so; keep target globs reasonably scoped |
| The same agent writes the code and its tests | The gate checks test *existence*, not test *quality*. The `/spec-verify` semantic pass (advisory) flags tests that prove something else; an independent reviewer pass is recommended for risky changes |
| Approval flags (`human_approved`, waiver `granted`, `accepted_by`, `understood_by`) are written by the agent on the human's explicit sentence | `human_approved` and waivers are cross-checked against `DECISIONS.md`; the rest relies on discipline (documented) |
| `--scope` downgrades foreign reds **in the report only** | Evidence and `gate_ok` are always computed unfiltered; never use it in CI |
| Comprehension can be escaped with a `comprehension-debt` waiver (owner + expiry) | Intentional: conscious debt over silent debt. The walkthrough artifact itself is still required |
| Compaction keeps only the mechanism line of a walkthrough | The full text remains in git history |
| Capabilities are dormant until the C4 model is tagged (`cap:<capability>`) | Warnings guide `/diagram-sync`; nothing breaks meanwhile |
| Gates never depend on MCPs (Structurizr / codebase-memory) | Structural and code graphs are interactive-session enhancements; CI stays deterministic |
| The pre-commit hook is machine-local (`.git/hooks/`), not versioned | Reinstall it per clone; the scaffold ships the current version |
| Not implemented (deliberate): evidence signing, orphan-code/undeclared-dependency detection, consumer migration on breaking changes, auto-archive, a generated CI workflow asset | See `SKILL.md` → *Implementation status* |
