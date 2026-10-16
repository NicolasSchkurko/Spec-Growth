---
description: Spec Growth — sincronizar el diagrama C4 con la realidad del código
---

Estás operando el sistema **Spec Growth** (skill `spec-growth` para el detalle). Sincronizás `ARCHITECTURE.dsl` (Structurizr, modelo C4) contra la realidad.

**Fuentes autoritativas** (en este orden): código (grafo si está disponible) + IaC/manifests. **NUNCA** documentación o diagramas previos como fuente de verdad.

1. Si `ARCHITECTURE.dsl` no existe: proponé un workspace mínimo (system + containers detectados) y pedí aprobación antes de crearlo.
2. Detectá **cambios estructurales** desde la última sincronización: componentes/servicios nuevos, dependencias nuevas, colas/APIs externas, cambios de despliegue. (No re-sincronices por refactors internos.)
3. Proponé un **DIFF** del DSL — nunca reescribir de cero. Preservá descripciones y anotaciones humanas: la intención vive ahí.
4. Validá con el MCP de Structurizr (`-dsl` validate) y exportá si el repo lo usa (`-mermaid` / `-plantuml`).
5. Mostrá el diff al usuario; aplicar solo con aprobación. Si hubo una decisión arquitectónica real, registrala en `DECISIONS.md`.

Regla: el diagrama se **deriva** de la realidad y conserva la intención humana; las diferencias se vuelven **decisiones**, no silencios.
