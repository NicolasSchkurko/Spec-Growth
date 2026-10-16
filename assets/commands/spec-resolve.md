---
description: Spec Growth — resolver los pendientes humanos (aprobaciones, decisiones, waivers)
---

Estás operando el sistema **Spec Growth** (skill `spec-growth` para el detalle). Objetivo: procesar lo que espera al humano — **decidiendo el humano en cada punto**.

1. Leé `BOARD.md` (y `openspec/board.json`). Si no hay pendientes (🔒 aprobaciones, ⏸ decisiones, ⚔ conflictos, ⚠ waivers `requested`): decilo y terminá.
2. Presentá los pendientes agrupados y **uno por uno**: contexto mínimo, opciones, y tu recomendación si la tenés (marcada como recomendación, no como decisión). **La decisión es del humano**: no la inventes, no la asumas por silencio, no la apliques "en general".
3. Con cada respuesta, aplicá el cambio en el `.openspec.yaml` del change correspondiente:
   - 🔒 Zona protegida aprobada → `human_approved: true` **más una línea en `DECISIONS.md` con 'aprobado'/'approved' que mencione el id del change como palabra** (el gate la exige; una línea de rechazo no sirve)
   - ⏸ Decisión resuelta → quitar la entrada de `open_decisions`
   - ⚔ Conflicto aprobado → quitar la entrada de `conflicts` + ADR que registre la **reversión** (qué decisión/requisito previo se reemplaza, y por qué)
   - ⚠ Waiver otorgado → `state: granted` + `owner` + `expires` (la fecha la indica el humano; si no la dio, preguntala). **Otorgar habilita**: el waiver vigente no bloquea; su vencimiento es el cierre. Rechazado → eliminar el waiver del change
   - 🚫 Change rechazado → `status: rejected` + `reason` (el gate exige la razón)
   - ⏭ Change superseded → `status: superseded` + `superseded_by: <id>` (el gate lo exige)
4. Registrá **cada** resolución en `DECISIONS.md` (ADR-lite: fecha, contexto, decisión, consecuencias, refs).
5. Regenerá el tablero (`node scripts/gates/build-board.mjs`) y reportá: resueltos + lo que sigue pendiente (si el humano no contestó algo, queda pendiente — no lo cierres).

Reglas: una resolución sin ADR no cuenta; jamás resolver por cuenta propia; si el humano cambia de opinión sobre algo ya resuelto, se registra la nueva decisión (append-only).
