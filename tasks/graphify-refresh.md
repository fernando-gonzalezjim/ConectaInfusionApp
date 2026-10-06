# Graphify incremental refresh cadence

Approved October 4, 2026: refresh changed sources automatically after every three completed implementation steps; no user reminders or hooks.

- Last completed refresh: I38, covering I36 deactivation, I37 prior-guardian renewal/reactivation and I38 lifecycle UI/current-state reads.
- Completed steps since that refresh: 2 (I39 verification runner/regression and I40 documentation/handoff).
- Next scheduled refresh: after three additional implementation steps (I39, I40, then the next approved capability step).
- Snapshot status: current through I38 implementation; I39-I40 verification, setup/handoff, README, capability-map and tracking updates are not yet included. No runtime source changed in I39-I40. Subsequent Identity documentation relocation and acceptance updates are also not yet represented; graph source paths may point to the former locations. The move is documentation maintenance and does not advance the counter. Source files/specification remain authoritative and the graph is not a completeness proof.

## October 5, 2026 I36-I38 refresh evidence

Only 51 changed files were re-extracted: 41 code sources and 10 documents, about 54,400 words before final evidence edits. Unchanged fragments were retained; no full rebuild or hooks were enabled. Sensitive `.npmrc` was excluded. Both PDF snapshots remain unchanged. Structural extraction used the existing sequential Windows process guard; document extraction used host agents without an external API key. Host semantic token usage is unavailable, not zero.

Final node/edge/community counts and fresh extraction/merged integrity diagnostics are recorded in [the graph report](../graphify-out/GRAPH_REPORT.md) and [integrity diagnostics](../graphify-out/graph-health.json). Missing or synthesized endpoints and undirected collapses do not prove implemented relationships. The original extraction's 16 dangling endpoints and 11 collapses remain historical limitations; consult current source before relying on graph relationships.

At each successful refresh, record included steps and evidence, reset the counter and set the next three-step boundary. Routine documentation/PDF exports or sub-slices are not separate steps. Retain unchanged fragments and integrity diagnostics.
