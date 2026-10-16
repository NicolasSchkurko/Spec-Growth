# Patch for the `spec-anchored` schema (after `openspec schema fork spec-driven spec-anchored`)

Goal: make the workflow require our metadata (`kind`, `targets`, `tests`; `waivers`/`open_decisions`/`conflicts` optional) and `[@test]`.

1. Open `openspec/schemas/spec-anchored/schema.yaml` and find the instructions of each artifact.
2. **specs** artifact (delta): in the instructions add: *"Every requirement includes WHEN/THEN scenarios and a `[@test] <test path>` line verifying it"*.
3. **proposal** artifact: add: *"Fill `.openspec.yaml` with kind (fix|feature|architecture|refactor), targets, tests, deps, gitref; `conflicts` only if the change contradicts something already decided/written"*.
4. **design** artifact: clarify *"mandatory if kind=architecture; optional otherwise"*.
5. Save and validate: `openspec schema validate spec-anchored`.

**Spike note:** if the schema's internal format differs from what is expected, apply these edits in the same spirit (require metadata + `[@test]` + conditional design) where appropriate, and note the difference in `DECISIONS.md`. If `openspec schema fork` does not exist in the installed version, create `openspec/schemas/spec-anchored/` by copying the `spec-driven` schema from the package and apply the same.
