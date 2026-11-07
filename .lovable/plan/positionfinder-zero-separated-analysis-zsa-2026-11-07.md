# PositionFinder Zero-Separated Analysis (ZSA)

## Goal
Add ZSA as an independent, evidence-traceable research workspace inside the existing PositionFinder app. Preserve the current positional transition analyzer, historical records, saved analyses, importer, and shared account-free testing workflow. Treat recurrence as historical evidence, never as a guaranteed prediction.

## Plan
1. **Add a separate ZSA foundation.** Build a lossless grouped-data parser and preview that retain game/provider, source order, raw text, group boundaries, line roles, validation issues, and duplicate occurrences. Do not reuse the legacy parser's inferred three-line grouping. Ambiguous boundaries require user confirmation; incomplete or invalid lines remain visible and cannot shift later groups.
2. **Store provenance and confirmations additively.** Reuse `games`, `historical_draws`, and `import_batches`; add only ZSA-specific records for source occurrences, three-line groups, confirmed winner results/positions, immutable analysis-run group snapshots, and live-validation cases. Persist the ten candidate values separately from the five explicitly confirmed winners. Keep incomplete groups and unconfirmed positions representable but exclude them from calculations that require those facts. Preserve original source text and correction history.
3. **Create a standalone deterministic ZSA engine.** Add `src/lib/zsa-analyzer.ts` and focused tests. Implement unordered winning-pair recurrence; same-game versus cross-game evidence; all-ten-position and source-number frequencies; exact source-position/number to winning-position/value mappings; direction-preserving two-source combinations; date/provider/game/threshold filters; and complete evidence for each result. Exclude incomplete groups and never assume candidate values are winners.
4. **Add ZSA views without replacing existing screens.** Add a ZSA navigation area for overview, pair recurrence, position/number analysis, combinations, exact mapping, cross-game evidence, data quality/import, saved reports, and live validation. Use existing design-system controls and evidence-expansion patterns. Save reports with immutable input snapshots and reproducible filters; paginate evidence where useful.
5. **Add isolated live validation.** Store the Golden Chance Bazooka Validation Case 001 separately, with its supplied Line 2 and five winners, no invented Line 3, and no training-data inclusion. Evaluate only against a frozen pre-result ZSA snapshot; allow Line 3 and confirmed winner positions to be attached later.
6. **Verify safely.** Apply additive database changes through the Lovable database migration workflow, with explicit grants and policies consistent with the currently requested shared testing workspace. Test RLS/access, provenance, parser/grouping, analytics, snapshot isolation, and validation behavior. Run the full Vitest suite, TypeScript check, lint, and production build; verify existing analysis/import/saved-analysis screens remain intact. Do not import the user's historical source data until it is uploaded and previewed/confirmed.

## Technical details
- Keep the existing transition analyzer and its test file unchanged except for compatibility fixes proven necessary by tests.
- Use the existing Supabase client and current TanStack route/UI conventions; add a dedicated ZSA module rather than mixing ZSA into `transition-analyzer.ts`.
- Model source occurrences separately from canonical historical draws so invalid and duplicate source records remain auditable. Associate each group with exactly one game and ordered Line 1/2/3 memberships.
- Keep confirmed winners relationally distinct from Line 3 candidates; record winner positions only when explicitly confirmed and validate them against candidate values.
- Snapshot each eligible group's ten values, confirmed winners, positions, game/date, and provenance at run time. Validation results must never mutate the evaluated snapshot or enter their own baseline.
- Existing data has no trustworthy three-line group boundaries or confirmed winners. Do not infer ZSA groups or winners from current draws; use the original source data the user will provide.
- The live Validation Case 001 is not historical training data. Full historical ZSA metrics remain pending the source-data upload and confirmation workflow.

## Acceptance criteria
- Existing app workflows and current analyzer behavior still pass their committed tests.
- Parsing preserves source order and group boundaries; malformed, duplicate, ambiguous, and incomplete records are surfaced rather than silently dropped or shifted.
- Only explicitly confirmed winners from complete eligible groups contribute to winning-pair and winner-position analyses.
- All analytics preserve positional identity, game isolation, exact mappings, and evidence-level traceability.
- Saved runs are reproducible from immutable snapshots; live validation cannot leak its own result into its baseline.
- Validation Case 001 stores its supplied Line 2 and five winners without inventing a Line 3 record.
- Migration, tests, typecheck, lint, build, and checks of existing workflows succeed.
- No historical source data is imported before the user supplies and confirms it.