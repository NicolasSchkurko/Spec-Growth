# Parche al schema `spec-anchored` (después de `openspec schema fork spec-driven spec-anchored`)

Objetivo: que el workflow exija nuestra metadata (`kind`, `targets`, `tests`; `waivers`/`open_decisions`/`conflicts` opcionales) y el `[@test]`.

1. Abrí `openspec/schemas/spec-anchored/schema.yaml` y localizá las instrucciones de cada artifact.
2. Artifact **specs** (delta): en las instrucciones, agregar: *"Cada requirement incluye escenarios WHEN/THEN y una línea `[@test] <ruta del test>` que lo verifica"*.
3. Artifact **proposal**: agregar: *"Completar `.openspec.yaml` con kind (fix|feature|architecture|refactor), targets, tests, deps, gitref; `conflicts` solo si el cambio contradice algo ya decidido/escrito"*.
4. Artifact **design**: aclarar *"obligatorio si kind=architecture; opcional en el resto"*.
5. Guardar y validar: `openspec schema validate spec-anchored`.

**Nota (spike):** si el formato interno del schema difiere de lo esperado, aplicar estas ediciones con el mismo espíritu (obligar metadata + `[@test]` + design condicional) donde corresponda, y anotar la diferencia en `DECISIONS.md`. Si `openspec schema fork` no existe en la versión instalada, crear la carpeta `openspec/schemas/spec-anchored/` copiando el schema `spec-driven` del paquete y aplicar lo mismo.
