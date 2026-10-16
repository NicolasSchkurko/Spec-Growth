---
description: Spec Growth — agregar un cambio (spec) al sistema, con alternativas, resultado esperado, zonas protegidas y decisiones
---

Estás operando el sistema **Spec Growth** en este repositorio (cargá la skill `spec-growth` si necesitás el detalle). Objetivo: crear un change nuevo en `openspec/changes/` a partir de: "$ARGUMENTS". **NO escribir código en este paso.**

1. **Contexto**: leé `BOARD.md` y `openspec/board.json` (registry de capacidades). Si está disponible el grafo de código (codebase-memory), consultalo para el stack existente; si no, leé `openspec/specs/` relevante (y sus IDs `[REQ-…]`) y las dependencias del proyecto.

2. **Clarificá** (máx 4 preguntas): qué y para quién; criterio de aceptación. Elegí `kind` = `fix` | `feature` | `architecture` | `refactor` y explicá la elección en una línea (un `refactor` no cambia comportamiento: su prueba es la suite verde + `[@test]` de regresión). Para `feature`/`architecture`, agregá la pregunta de **resultado**: *"¿qué resultado esperás y cómo sabremos si valió la pena?"* — se registra como "Resultado esperado" en `proposal.md`; si no hay respuesta clara, anotalo como duda (no bloquea).

3. **Alternativas técnicas** — obligatorio cuando el pedido **embebe una decisión técnica** ("usar SQLite", "con tal librería", "todo en el cliente"); omitir solo en `kind: fix` trivial. Si aplica:
   - **Opción 0 — reutilizar**: buscá en el registry de capacidades (`provides: [cap:x]` en las specs) y en el grafo: ¿ya existe algo que resuelve esto? Si existe: *"use contract, do not rebuild"*.
   - Proponé **2-3 alternativas** (incluida la pedida) evaluadas contra: requisitos; tamaño y contexto real del repo (ej.: si guarda muchísimos datos, contrastar SQLite vs MySQL/Postgres con esa evidencia); costo; riesgos; reversibilidad; y qué zonas/invariantes toca.
   - Presentá una **tabla corta** (opción · por qué sí · por qué no · recomendación) y preguntá al humano cuál queda. **La decisión es humana.**
   - Si existe una decisión que **no es tu autoridad** y el humano aún no decidió: registrala como **decision request** (`open_decisions: [{question, target, proposal}]`).
   - Si el pedido **contradice algo ya decidido o escrito** (un ADR de `DECISIONS.md`, un requisito vivo, un waiver vigente): registrá un **conflicto ⚔** (`conflicts: [{with, what, proposal}]`) — se aprueba explícitamente (reversión + ADR) antes de `verified`.
   - Registrá el resultado: sección "Alternativas consideradas" en `proposal.md`; si es decisión de arquitectura real → evaluá subir a `kind: architecture` + ADR en `DECISIONS.md`.

4. **Zonas protegidas**: con los `targets` definidos, cruzalos contra `protected:` de `openspec/config.yaml`. Si tocan una zona: avisá *"🔒 esto va a requerir tu aprobación explícita (human_approved)"*.

5. **Creá el change**: `openspec new change <id-kebab>` (schema `spec-anchored`). Redactá:
   - `proposal.md`: por qué + qué (corto) + "Resultado esperado" (si aplicó) + "Alternativas consideradas" (si aplicaron).
   - `specs/<capacidad>/spec.md`: delta con Requirements (SHALL) y escenarios WHEN/THEN. **Cada requirement lleva una línea `[@test] <ruta-al-test>`.** Si el proyecto usa **IDs de requisito** (mirá las specs vivas), asigná `[REQ-<capacidad>-<n>]` a los nuevos y conservá el ID de los existentes. Los tests/código pueden citarlos con `@cita REQ-…` (opcional; habilita el detector de citas rotas/alucinaciones).
   - `tasks.md`: checklist verificable. Si el cambio es grande, proponé la **primera rebanada vertical más riesgosa** (hardest-first).
   - `design.md`: SOLO si `kind: architecture`.

6. **Metadata**: completá `.openspec.yaml` con `kind`, `targets`, `tests`, `deps`, `gitref: <git rev-parse --short HEAD>`; `waivers` / `open_decisions` / `conflicts` solo si aplican.

7. **Conflictos**: si otro change activo reclama un `target` en común, avisar y proponer plan. Si declarás la **dependencia** (`deps`), el gate trata el overlap como **secuenciado** (warning, no error); si son independientes, secuencialos o replanificá.

8. **Validar y tablero**: `openspec validate <id> --strict` y `node scripts/gates/build-board.mjs`.

9. **Resumen final**: id, kind, capacidades, targets, zonas protegidas afectadas (si hay), decisiones abiertas (si hay), resultado esperado, alternativas consideradas (si hubo) y que queda `status: draft` esperando **aprobación humana** (al aprobar: `status: accepted` + `accepted_by` + `accepted_at`).

Reglas: un change por idea; nada de código acá; `[@test]` obligatorio si `kind: fix`; alternativas obligatorias cuando el pedido trae una decisión.
