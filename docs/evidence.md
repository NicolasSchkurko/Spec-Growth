# Evidence base & known limits

The system's core architecture follows one primary source — **The Spec Growth Engine** (Grabowski, [arXiv:2606.27045](https://arxiv.org/abs/2606.27045)) — and its comprehension mechanisms (v1.0: tech brief, teach-back, expressivity rules, `/spec-explain`) are grounded in recent GenAI-assisted software-engineering research. The rest — gates, states, approvals, audit rounds — comes from engineering practice, hardened through adversarial audit rounds (v0.5 → v1.0).

This page records what each mechanism is based on, what transfers and what does not, the critiques this approach attracts (some of which hit us), and the consolidated known limits.

**Sourcing note.** arXiv links on this page were checked when written (2026-10-16) and the described findings match the published abstracts. Non-arXiv items are linked to their canonical pages. Quotes attributed to named authors, and figures marked *(reported)*, come from the linked material but were not independently re-run.

## Primary source → what it shapes here

*The Spec Growth Engine: Spec-Anchored, Code-Coupled, Drift-Enforced Architecture for AI-Assisted Software Development* (H. Grabowski, [arXiv:2606.27045](https://arxiv.org/abs/2606.27045), v2, Oct 2026).

The paper names the two structural failure modes this system exists to fight:

1. **Context explosion** — the agent must reason over an entire repository at once, and output quality degrades as the context window fills.
2. **Silent spec–code drift** — code evolves, the specification does not, and the divergence becomes invisible until it is costly to repair.

| Paper construct | In this system |
|---|---|
| Machine-readable spec graph with contract/design separation | `openspec/specs/` (contract) vs `design.md` / `walkthrough.md` (how) |
| **Spine context assembler** — scopes agent context to an ownership path instead of the whole repo | The token-diet direction (`references/`, subagents, scoped reads) measured in `quality/conformance/` |
| Vertical-slice growth protocol (hardest-first ordering) | `tasks.md`: small verifiable steps, riskiest first |
| **Drift gate** — spec–code divergence is a blocking merge condition | `gate-check.mjs` + `--pre-archive` + the `/spec-verify` semantic pass |
| Lean synthesis of Parnas, C4, ADRs, Walking Skeleton, Reflexion Models, Fitness Functions — without the weight of RUP or MDA | Thin prompts, one generated document (BOARD.md), deterministic scripts |

Implementation companion: [arXiv:2610.11725](https://arxiv.org/abs/2610.11725) · reference code: [github.com/grabow/spec-growth-engine](https://github.com/grabow/spec-growth-engine).

## Research base → what it caused here

| Source | Finding | Mechanism in Spec Growth |
|---|---|---|
| Ahmad 2026, *Comprehension Debt in GenAI-Assisted SE* (EASE 2026 · [arXiv:2604.13277](https://arxiv.org/abs/2604.13277)) | 621 reflective diaries from 207 students: comprehension debt accumulates even when the code is clean and the tests are green; four accumulation patterns — black-box acceptance, context mismatch, dependency-induced atrophy, **verification bypass** | The premise: machine-green ≠ understood. The walkthrough + comprehension sign-off ritual; the gate never equates `verified` with "understood" |
| Sankaranarayanan 2026, *Mitigating "Epistemic Debt" in GenAI-Scaffolded Programming* ([arXiv:2602.20206](https://arxiv.org/abs/2602.20206)) | Controlled experiment (N=78): unrestricted AI and scaffolded AI tie on speed, but unrestricted users fail **77% vs 39%** on a later maintenance task; the winning condition was an **Explanation Gate** (teach-back before integrating generated code) | The teach-back in `/spec-verify`: free recall, the agent validates against the real code (`file:line`), corrects misconceptions, max 2 rounds — only then the sign-off is recorded |
| Shen & Tamkin 2026, *How AI Impacts Skill Formation* ([arXiv:2601.20245](https://arxiv.org/abs/2601.20245)) | RCT (52 engineers, a new library): passive delegation impairs conceptual understanding, code reading and debugging (~17-point drop in the follow-up comprehension quiz, 50% vs 67%), while active, question-driven use preserves learning | Passive approval is not the path: the system pushes *consultation* — `/spec-explain` for existing code, interactive questions at apply/verify, "the human decides" at every gate |
| Saha et al. 2026, *Cognitive-Load-Aware Automated Refactoring* (EASE 2026 · [arXiv:2603.16791](https://arxiv.org/abs/2603.16791)) | Cognitively guided refactoring cut refactoring failures by **54–71%** and improved novice comprehension (function identification +31.3%, structural readability +22.0%) | The expressivity rules (semantic wrapping at physical boundaries, boundary header comments, no premature abstraction) and `/spec-explain` proposing a `kind: refactor` when code is opaque |
| Ye et al. 2026, *Readability Issues in LLM-Generated Code* ([arXiv:2605.13280](https://arxiv.org/abs/2605.13280)) | 2,735 scenarios: LLM code hides latent readability debt — excessive complexity, redundant comments, **unknown-API usage**; prompt constraints help but have a ceiling | The **Touched APIs** walkthrough section (every new API explained in 1–2 lines), the anti-noise comment policy, and the opacity audit (code → text) in `/spec-verify` |
| Osmani 2026, *Comprehension Debt* ([blog](https://addyosmani.com/blog/comprehension-debt/)) | Translating a spec to code involves dozens of implicit decisions no test captures; "tests are necessary, not sufficient"; the comprehension work is the job | The walkthrough targets the *implemented mechanism* (not more spec prose) and records **implicit decisions**; the spec stays the contract |

## Direct empirical support (2026)

| Source | Finding | What it backs here |
|---|---|---|
| Tufano et al., *Grounding AI Agents in Contracts: An Empirical Evaluation of Spec-Driven Test Generation* (Google · SpecOps 2026 · [arXiv:2608.17177](https://arxiv.org/abs/2608.17177)) | Asking an agent to document pre/post-conditions and undefined behaviors before writing tests: **+9.8pp** bug detection (p=0.0352), **+2.5pp** branch coverage (p=0.0034) on production bugs at Google. Tests judged **superior to the baseline in 77.8%** and **to human-authored tests in 56.7%** of cases; better edge-case coverage. Additional figures *(reported)*: 63.2% overall detection at k=5, 12 bugs found uniquely vs 3 the other way | The core bet, measured: **specs → better verification evidence**. Our chain is the same shape — spec requirement → `[@test]` → recorded evidence |
| Xue, *When and How Context Rot Appears in Coding Agents* ([arXiv:2607.17937](https://arxiv.org/abs/2607.17937)) | White-box code-audit study: Codex passes **8/10** runs in a clean 11k-char context vs **3/10** in a ~300k-char context (large, but trend-level: p=0.0698); requirement coverage stays >92% yet a few omissions invalidate the artifact. **A detailed external checklist passes 10/10 vs 5/10 for a generic self-check (p=0.0325)**. Loading a skill does not guarantee its requirements stay active in long trajectories | Three things we already build on: `gate-check` **as the external checklist**; keeping sessions lean (the token diet); and invariants living in **deterministic scripts**, not only in prose |
| Deng et al., *SWE-Milestone* (DeepCommit · ICML 2026 · [arXiv:2603.13428](https://arxiv.org/abs/2603.13428)) | 12 frontier models, 4 agent frameworks: performance drops from **>80% on isolated tasks to 38.03% in continuous settings** — long-term maintenance and error propagation are the weak spot | Why the change/archive/drift machinery exists: the hard problem is *evolution*, not the one-off task |
| *Specification-Driven Code Generation* (SANER 2026, tool CURRANTE) *(reported)* | Measures how human intervention in the spec → test → implement flow affects quality | Human-in-the-loop spec work as the quality lever — the shape of `/spec-add` → approval → `/spec-apply` |

## The ecosystem is formalizing

- **Piskala, *Spec-Driven Development: From Code to Contract*** (AIWare 2026 · [arXiv:2602.00180](https://arxiv.org/abs/2602.00180)) — three levels of rigor: **spec-first / spec-anchored / spec-as-source**, with a decision framework for when SDD pays off and when simpler approaches suffice. This system is, by that taxonomy, deliberately **spec-anchored**.
- **SDAD: Spec-Driven Agentic Development for the AI-Native SDLC** ([arXiv:2608.20341](https://arxiv.org/abs/2608.20341)) — "agentic speed does not eliminate engineering discipline; it relocates discipline upstream into specification precision, explicit gates, and auditable provenance." Also proposes governance metrics (Ambiguity Tax, Spec Fidelity, Synthesis Efficiency Ratio) and a dedicated section on maintaining human comprehension.
- **Agentic Software: How AI Agents Are Restructuring the Software Paradigm** ([arXiv:2606.05608](https://arxiv.org/abs/2606.05608)) — stage model (tool-augmented → single-task autonomous → teams → self-evolving ecosystems); humans shift from "doing" to "specifying what to do and verifying what was done".
- **Martinelli, *Spec-Driven Development: From Specs to Code with AI Agents*** (Apress, Aug 2026 · [Springer](https://link.springer.com/book/10.1007/979-8-8688-2851-5)) — the "AI Unified Process", with a pitfalls chapter. The topic reached book form.
- Also in this wave *(named; not verified here)*: Faithfulness Loss benchmarks; Agent Behavioral Contracts (formal contracts with runtime enforcement); Agyn (multi-agent teams, 72.2% SWE-bench claim).

## Critiques — what hits us, and our answers

- **"Waterfall strikes back."** Marmelab ([Zaninotto, Nov 2025](https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html)) and John Ferguson Smart *(reported)*: most spec-driven development is waterfall with an AI doing the typing — agility buried under layers of Markdown.
  *Our answer:* proportional ceremony — a small fixed command surface, one generated document (BOARD.md), specs only for behavior changes; and by Piskala's taxonomy we sit at **spec-anchored** (specs evolve with the code), never frozen phase gates.
- **Output vs outcome.** Scrum.org, [*SDD Isn't Waterfall — Unless You're Using It That Way*](https://www.scrum.org/resources/blog/spec-driven-development-isnt-waterfall-unless-youre-using-it-way): returns to specifying arrive early, and a faithfully implemented spec can still ship "AI capabilities that weren't moving the needle."
  *Our answer:* honest gap — **nothing in the system asks whether a change is worth doing**; the only outcome gate is human acceptance, and it is subjective. This is the deepest open problem, not a solved one.
- **Determinism and variance.** *Citation Discipline in Spec-Driven Development* ([arXiv:2606.30689](https://arxiv.org/abs/2606.30689)): prose-spec toolkits can *reduce* output determinism versus plain prompts (Spec Kit the highest variance *(reported)*); but per-requirement citations unlock automated hallucination detection — TDR **86.4–88.0% vs 0%** uncited, at 0% false positives. *Caveat:* the cited tool (traceSDD) is the author's own.
  *Our answer:* the gate already understands `[REQ-…]` IDs and `@cita` cross-checks when a repo opts in; making that first-class is a candidate below.
- **Context rot inside skills.** The same study above: loading a skill does not keep its requirements active through long trajectories — discipline cannot live only in Markdown.
  *Our answer:* invariants live in deterministic scripts (the gate), not prose; prompts shrink over time (token diet), gates stay.
- **Tooling and instruction bloat.** [Thoughtworks Radar Vol. 34](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf) (Apr 2026): "agent instruction bloat… instructions become long and sometimes conflict"; Fowler's review of SDD tools: [overkill for the size of the problem](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html); a community field study *(reported)*: Kiro turning one bug into 16 acceptance criteria.
  *Our answer:* the token diet in progress (measured per-run in `quality/conformance/`), thin prompts, sharp scripts.
- **Community saturation.** Recurring "stop building memory/agent frameworks" sentiment (r/ClaudeCode threads; HN debates around the posts above) *(anecdotal)*.
  *Our answer:* every mechanism must pay rent — the conformance suite exists to measure exactly that.

## Caveats (what does NOT transfer)

- **Populations**: the strongest results come from studies with students/novices (Ahmad: 207 students; Sankaranarayanan: novice "vibe coders"; CDDRefactorER: novice programmers). The *mechanisms* transfer; the *effect sizes* should not be read as production-team guarantees.
- **Trend-level results**: the context-length effect in arXiv:2607.17937 is large but trend-level (p=0.0698) and explicitly not a universal threshold — treat it as a prudence argument for lean contexts, not a law.
- **Qualitative vs experimental**: Ahmad is a qualitative study of accumulated debt — treat it as the problem statement, not a measured effect.
- **Vendor/author tools**: the TDR figures come from the authors' own tool; the Tufano evaluation is by Google engineers on Google bugs; Agyn's 72.2% is a self-reported claim. Directionally useful, not neutral.
- **Our own gate verifies the ritual, not the understanding**: it can check that a walkthrough exists, is complete and is signed — it cannot check that you actually understood it. That is a documented limit below, not a hidden one.

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
| **Nothing measures outcome** — the system verifies that what was specified got built, not that it was worth building | Open gap (see Output vs outcome above); human acceptance is the only gate |
| Not implemented (deliberate): evidence signing, orphan-code/undeclared-dependency detection, consumer migration on breaking changes, auto-archive, a generated CI workflow asset | See `SKILL.md` → *Implementation status* |
