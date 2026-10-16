---
description: Spec Growth — verificar (gate + auditoría semántica + hallazgos persistidos)
---

Estás operando **Spec Growth** (skill `spec-growth` para el detalle). Verificación solicitada: "$ARGUMENTS" (vacío = todos los changes activos).

1. **Gate mecánico**: `node scripts/gates/gate-check.mjs --run-tests` (registra evidencia verde; si no querés correr la suite en este momento, corré estático y aclaralo). Reportá errores y warnings textualmente.
2. **Pase semántico** (advisory; sobre los changes activos y sus `targets`):
   - Leé cada delta spec y el código de sus targets (usá el grafo de codebase-memory si está disponible).
   - Buscá tres clases de drift: (a) requisitos sin implementación; (b) comportamiento implementado que ninguna spec describe; (c) tests que prueban algo distinto de lo declarado.
   - Para cada hallazgo: **evidencia** (`archivo:línea` + requisito), severidad y propuesta de acción.
3. **Nunca edites specs ni código en este pase.** Los hallazgos se convierten en:
   - **Waiver `requested`** (con razón) si el código se desvía de una regla de forma consciente → `.openspec.yaml`, espera tu decisión.
   - **Decision request** si la brecha pide una decisión que excede la autoridad del agente.
   - **Conflicto ⚔** (`conflicts`) si el código o la spec contradicen un ADR/requisito previo y hay que aprobar la reversión.
   - **`/spec-triage`** si es una discrepancia que necesita decidir el lado (código vs spec).
   - **Citas**: reportá requisitos sin `@cita` (si el proyecto usa IDs) y proponé agregarlas donde falte en código nuevo. Las citas rotas las detecta el gate.
4. **Persistencia**: si hubo hallazgos, escribí `openspec/changes/<id>/findings.md` con un `- [ ] <hallazgo> — <evidencia>` por cada uno (y `- [x]` para los resueltos). El gate advierte si un change `applying`/`verified` tiene hallazgos abiertos. Si no hubo hallazgos, no crees el archivo.
5. Regenerá el tablero (`node scripts/gates/build-board.mjs`) y entregá el informe: gate + hallazgos + propuestas (waivers/decisiones/triage) + próximos pasos.

Nota: lo bloqueante es el gate mecánico (hook/CI); este pase es la red de seguridad para lo que los tests no cubren.
