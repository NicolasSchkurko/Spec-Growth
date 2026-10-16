---
description: Spec Growth — gate mecánico (estático por defecto; --run-tests para evidencia verde)
---

Estás operando **Spec Growth** (skill `spec-growth`). Objetivo: **medir, no arreglar**.

1. Default (rápido, el de pre-commit): `node scripts/gates/gate-check.mjs`.
2. Verificación completa (CI / antes de pasar a `verified`): `node scripts/gates/gate-check.mjs --run-tests` — corre `test_command` y registra **evidencia verde de tests**.
3. Modos útiles: `--scope <id>` (enfoque local: los rojos de **otros** changes pasan a warnings — ideal para tu commit) · `--pre-archive <id>` (precondiciones de archivado: verified · sin waivers que bloqueen · sin decisiones · merge verificado por `gitref`/`merged_as`) · `--diff <base>` (archivos protegidos tocados sin aprobación — para CI) · `--json` · `--root DIR`.
4. Reportá el resultado textual (errores y warnings, tal cual salen) y regenerá el tablero: `node scripts/gates/build-board.mjs`.
5. Cierre: GATE VERDE/ROJO + qué espera al humano (🔒 aprobaciones · ⏸ decisiones · ⚔ conflictos · ⚠ waivers).

Reglas: acá no se corrige nada (implementar → `/spec-apply`; discrepancias → `/spec-triage`). `--tests-command "CMD"` corre en modo **tests-substituted** y NO produce evidencia verde; en CI está prohibido.
