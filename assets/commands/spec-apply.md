---
description: Spec Growth — aplicar un change pendiente (evidencia verde, citas, aprobaciones, pre-archive)
---

Estás operando el sistema **Spec Growth** (skill `spec-growth` para el detalle). Aplicá el change: "$ARGUMENTS" (id). **Un solo change por vez.**

**Precondiciones** (si fallan, parar y avisar):
- El change existe y su `.openspec.yaml` tiene `status: accepted` (si está en `draft`: pedir aprobación humana; al aprobar: `status: accepted` + `accepted_by` + `accepted_at`).
- Sus `deps` están archivadas o verificadas (el gate lo chequea).
- **Contexto limpio**: implementá en una sesión fresca (o compactada a propósito) — el contexto largo degrada la ejecución (8/10 vs 3/10 medido). No arrastres la sesión donde discutiste el diseño.
- **Zona protegida**: si algún `target` cruza `protected:` de `openspec/config.yaml` y no hay `human_approved: true` → **pedí la aprobación humana ANTES de implementar**. Al aprobar: `human_approved: true` + ADR en `DECISIONS.md`.
- **Decisiones abiertas**: si hay `open_decisions` sin resolver, avisar que el change no podrá llegar a `verified` hasta resolverlas (podés implementar; el cierre queda pendiente).
- **⚔ Conflictos**: si el change tiene `conflicts` sin aprobar, podés implementar, pero no llegará a `verified` (y `--pre-archive` lo bloquea) hasta que el humano apruebe la reversión (quitar la entrada + ADR).

**Ejecución:**
1. `git checkout -b change/<id>` (si ya existe, continuar en ella). Al commitear los cambios, actualizá `gitref` en `.openspec.yaml` al **tip de la branch** (`git rev-parse --short HEAD`) — es lo que `--pre-archive` verifica contra **HEAD** (squash-merge: usá `merged_as: <sha del commit squash>`).
2. Implementá `tasks.md` tarea por tarea. Escribí los tests de cada `[@test]` que falten. Si el proyecto usa **IDs de requisito**, citá en tests/código lo que cubrís: `@cita REQ-…` (una cita a un ID inexistente es error del gate — detector de alucinaciones).
3. Actualizá `.openspec.yaml`: `status: applying`.
4. Corré tests + gate: `node scripts/gates/gate-check.mjs --run-tests` (usa `test_command`; registra la **evidencia verde**). Corregí lo rojo y repetí. Sin `test_command` configurado, corré la suite a mano y avisá: el gate exigirá evidencia verde para `verified`.
5. **Reporte obligatorio al usuario** (formato fijo, corto):
   - Change: `<id>` (kind)
   - Por requisito: requirement (ID si existe) → archivos tocados (`archivo:línea`) → test que lo prueba → estado
   - Zona protegida: aprobación (sí/no/n-a) · Waivers abiertos · Decisiones pendientes · Citas (rotas / sin cita, si aplica)
   - Resultado del gate + evidencia registrada (`evidence.json`)
   - Dudas abiertas / decisiones tomadas durante la implementación
6. **`verified` solo si**: gate verde **con evidencia de tests** + sin waivers que bloqueen (requested/vencidos) + sin decisiones pendientes + (zona protegida → aprobada **con su id en `DECISIONS.md`**). Si no, queda `applying` con la lista de bloqueos.
7. Si el change es `kind: architecture`: sugerir `/diagram-sync` antes de archivar.
8. **Pre-archive** (después del merge, antes de archivar): `node scripts/gates/gate-check.mjs --pre-archive <id>` debe dar **OK** (verified · sin waivers · sin decisiones · `gitref` mergeado). Recién entonces: `openspec archive <id>`.

**Al final indicá**: revisar el diff, mergear, y recién ahí archivar con las precondiciones OK.
