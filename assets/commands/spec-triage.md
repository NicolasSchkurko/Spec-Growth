---
description: Spec Growth — triage de un bug/discrepancia (decide el lado y registra)
---

Estás operando el sistema **Spec Growth** (skill `spec-growth` para el detalle). Entrada a triage: "$ARGUMENTS" (bug, discrepancia, hallazgo del pase semántico o incidente).

1. **Evidencia primero**: reproducí o localizá el comportamiento en el código (archivo:línea) y el requisito en la spec que lo cubre (si existe). Citá ambos con precisión.
2. **Definí la discrepancia en una frase**: "el código hace X; la spec dice Y".
3. **PREGUNTÁ AL USUARIO** — la decisión es humana, no tuya: *¿quién tiene razón, el código o la spec?* No continúes sin respuesta.
4. **Registrá la decisión** en `DECISIONS.md` (append): fecha · título · contexto · decisión · consecuencias · refs (archivo:línea + spec).
5. **Actuá según la decisión**:
   - **Código mal** → creá un change `kind: fix` con el requisito correcto y su `[@test]` de regresión (flujo de `/spec-add`).
   - **Spec mal** → creá un change que MODIFIQUE la spec al comportamiento correcto: usá `kind: fix` incluyendo un `[@test]` que apunte al test existente que cubre ese comportamiento; si no existe ninguno, pedí un waiver `deferred-test` (el gate exige regresión en `fix`). Si además hay que ajustar el código, incluir ambas partes.
6. `node scripts/gates/build-board.mjs` y resumen final: decisión tomada + id del change creado. Si la decisión **contradice un ADR previo o un requisito vivo**, el change nuevo lleva un **conflicto ⚔** (`conflicts`) y tu aprobación explícita de la reversión antes de `verified`.

Regla de oro: el triage **nunca** auto-agrega "el bug" como spec. Se especifica el **contrato** resultante, con su test.
