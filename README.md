# Spec Growth

Sistema **spec-driven / spec-anchored** para [OpenCode](https://opencode.ai). Las specs son el **contrato vivo del presente**; los changes, el **futuro en trámite**; el BOARD, una **vista generada**.

> **La máquina detecta; el humano decide.** Nada se aprueba por silencio: toda aprobación queda registrada (`.openspec.yaml` + `DECISIONS.md`) y el gate la verifica.

Es un retrofit serio sobre **OpenSpec** (`@fission-ai/openspec`) — sin forkear su filosofía, solo extendiéndola: metadata por change, evidencia verde real de tests, waivers con vencimiento, zonas protegidas con ADR cruzado, decisiones y conflictos ⚔ registrados, gates mecánicos en pre-commit/CI, tablero humano + índice de máquina.

## Qué resuelve

- **Drift spec↔código**: `/spec-verify` hace gate mecánico + pase semántico adversarial (requisitos sin implementación, código sin spec, tests que prueban otra cosa).
- **"¿De verdad está terminado?"**: `verified` no se declara — se gana con evidencia verde de tests (`gate-check --run-tests`).
- **Desviaciones y decisiones**: waivers ⚠ (los pide cualquiera, los otorga el humano), decisiones abiertas ⏸ y conflictos que contradicen lo ya escrito ⚔ bloquean el cierre hasta resolución registrada por ADR.
- **Zonas de riesgo**: `protected:` en config; tocarlas exige `human_approved` respaldado por una línea de ADR verificable.
- **Bugs**: la skill `bug-finder` corre en **modo anclado** — audita contra las specs vivas y `DECISIONS.md`, y cada bug entra por `/spec-triage` con test de regresión.
- **Refactors**: `kind: refactor` exige `[@test]` de regresión; el overlap entre changes secuenciado por `deps` se trata como orden planificado (warning, no error).

## Instalación (skill global de OpenCode)

```bash
git clone https://github.com/NicolasSchkurko/Spec-Growth.git ~/.config/opencode/skills/spec-growth
```

Windows (PowerShell):

```powershell
git clone https://github.com/NicolasSchkurko/Spec-Growth.git "$env:USERPROFILE\.config\opencode\skills\spec-growth"
```

Después, en cualquier repo git que quieras gestionar, pedile al agente: **"iniciá Spec Growth"**. El INIT verifica precondiciones, instala/verifica OpenSpec, agrega los MCPs que falten (codebase-memory, Structurizr), forkea el schema `spec-anchored`, aplica el scaffold (AGENTS.md, config, hook pre-commit, comandos) y regenera el BOARD.

## Comandos

| Comando | Rol |
|---|---|
| `/spec-add` | Crear un change (propuesta + delta spec + metadata). No escribe código |
| `/spec-triage` | Bug/discrepancia → decide el lado (humano) → ADR + `fix` con regresión |
| `/spec-apply` | Implementar UN change en su branch, con tests + gate y evidencia verde |
| `/spec-verify` | Gate + auditoría semántica: hallazgos, waivers y decisiones propuestas |
| `/spec-gate` | Medir y registrar (estático o `--run-tests`). No arregla nada |
| `/spec-resolve` | Resolver 🔒 aprobaciones · ⏸ decisiones · ⚔ conflictos · ⚠ waivers |
| `/diagram-sync` | Sincronizar el C4 (`ARCHITECTURE.dsl`) contra el código real |

## Estructura

```
SKILL.md            la spec canónica: glosario, INIT, operaciones, reglas, estado y límites
assets/commands/    los 7 comandos que el INIT copia a .opencode/commands/
assets/scripts/     gates: gate-check.mjs · build-board.mjs · compact-archive.mjs · lib.mjs
assets/scaffold/    AGENTS.md · config.yaml · hook pre-commit · schema-patch · seeds
```

## Estado

**v0.9** — endurecido en 4 rondas de auditoría/ingeniería adversariales (v0.5→v0.9). El detalle honesto de lo implementado y los límites conocidos vive en `SKILL.md` → *"Estado de implementación"*. Límites destacados: la evidencia es local y sin firma (la barrera real es CI con `--run-tests`), y `--scope` solo afecta el reporte local, nunca la evidencia.

## Requisitos

Node ≥ 20.19 · git · OpenSpec CLI · OpenCode. Los MCPs (codebase-memory, Structurizr) son opcionales: el INIT los agrega solo si faltan.
