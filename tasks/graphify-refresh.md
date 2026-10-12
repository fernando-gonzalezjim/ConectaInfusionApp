# Graphify incremental refresh cadence

Approved October 4, 2026: refresh changed sources automatically after every three completed implementation steps; no user reminders or hooks.

- Last completed refresh: C04, covering isolated completed C02 persistence, C03 discipline maintenance and C04 reusable-class runtime/test sources.
- Completed steps since that refresh: 2 (C05 instructor facts/portraits and C06 public discovery). C05/C06 were in progress at the C04 refresh boundary and completed afterward.
- Next scheduled refresh: C07 (C05 + C06 + C07).
- Snapshot status: scheduled changed-source refresh through completed C04 for 12 isolated sources. Shared runtime, contracts, client, translation, demo and documentation files overlapping in-progress C05/C06 are deliberately retained unstamped for C07. Post-refresh cancellation fixes to the class form/catalog-list helper are also deferred to C07. Other unselected fragments retain their earlier snapshot. The raw incremental manifest still detects historical runtime/hash differences; this bounded refresh does not claim completeness. Current source files and the approved specification remain authoritative.

October 11, 2026 planning note: the Studio Catalog specification, plan and C01-C33 checklist are approved; no catalog implementation task is completed. Without intervening implementation steps, C01 is the next three-step refresh boundary (I39 + I40 + C01), followed by C04/C07/C10 and every third parent task thereafter. Sub-slices do not count separately. No refresh ran during planning.

## October 11, 2026 C01 refresh evidence

The scheduled I39 + I40 + C01 boundary refreshes only completed-step documentation, relocated Identity guides and the three script help-link edits accompanying relocation. It excludes current C02 tests/migrations/demo writes, unrelated historical runtime differences and sensitive `.npmrc`. Unchanged graph fragments remain intact; relocated PDF graph provenance is remapped without reading, regenerating or changing either PDF snapshot. No full rebuild or hooks are enabled.

Semantic extraction uses the host session and dedicated Graphify extraction agents, with no external API key. Host semantic token usage is unavailable, not zero. Final counts, fresh/merged integrity diagnostics and exact included paths are recorded in `graphify-out/c01-refresh-evidence.json`, [the graph report](../graphify-out/GRAPH_REPORT.md) and [integrity diagnostics](../graphify-out/graph-health.json). Original dangling-endpoint/collapsed-edge limitations remain historical evidence, and source verification is required.

Refreshed 46 sources (43 documents and three completed relocation script snapshots), pruning 29 obsolete document paths. Deferred the catalog demo guide after detecting concurrent C02 edits; its hash and the current demo-seed hash remain unstamped for the next boundary. Preserved all 1,859 untouched node identities. Final graph: 2,225 nodes, 4,733 edges and 164 communities. Fresh extraction reports eight dangling AST endpoints and 364 undirected repeated-pair collapses; the merged graph has zero dangling endpoints because Graphify synthesizes references, which does not prove implementation. Both PDFs are byte-identical to HEAD. Raw detection's 205 historical changes remain a stated limitation outside this bounded refresh.

## October 11, 2026 C04 refresh evidence

The completed C02 + C03 + C04 boundary refreshes 12 isolated runtime/test sources: V15, discipline/class services and routes, their management components and catalog-list helper, migration/discipline/class integration tests, and the C03 live browser test. C04 completion was signaled after five backend cases, two client cases, three repeat-safe demo/reset cases and two live bilingual class journeys passed. These verification counts are source evidence, not inferred from the graph.

Shared API/Identity composition, App wiring, contracts/client/translations, seed helpers and current batch documents already contain C05/C06 work, so their graph fragments and manifest hashes remain unstamped until C07. The exact included paths/hashes and excluded overlapping files appear in [C04 refresh evidence](../graphify-out/c04-refresh-evidence.json). No full rebuild, hooks, semantic dispatch, PDF extraction or PDF regeneration occurred. Both PDFs were checked byte-identical to HEAD.

Structural extraction used the existing sequential Windows guard and retained all 2,225 untouched node identities. Final graph: 2,304 nodes, 4,914 edges and 163 communities. Fresh extraction reports 80 dangling endpoints and nine undirected repeated-pair collapses; the merged graph has zero missing endpoints because references may be synthesized, which does not prove their implementations. Raw detection found 209 differences; historical and overlapping differences remain explicitly outside this bounded refresh. This pure-code run incurred no semantic model calls; historical host semantic token usage remains unavailable, not zero.

## October 5, 2026 I36-I38 refresh evidence

Only 51 changed files were re-extracted: 41 code sources and 10 documents, about 54,400 words before final evidence edits. Unchanged fragments were retained; no full rebuild or hooks were enabled. Sensitive `.npmrc` was excluded. Both PDF snapshots remain unchanged. Structural extraction used the existing sequential Windows process guard; document extraction used host agents without an external API key. Host semantic token usage is unavailable, not zero.

Final node/edge/community counts and fresh extraction/merged integrity diagnostics are recorded in [the graph report](../graphify-out/GRAPH_REPORT.md) and [integrity diagnostics](../graphify-out/graph-health.json). Missing or synthesized endpoints and undirected collapses do not prove implemented relationships. The original extraction's 16 dangling endpoints and 11 collapses remain historical limitations; consult current source before relying on graph relationships.

At each successful refresh, record included steps and evidence, reset the counter and set the next three-step boundary. Routine documentation/PDF exports or sub-slices are not separate steps. Retain unchanged fragments and integrity diagnostics.
