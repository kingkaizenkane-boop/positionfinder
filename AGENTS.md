<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture decisions
- Keep Zero-Separated Analysis in independent parser, analysis, persistence, and UI modules so the existing transition analyzer and workflows remain behaviorally unchanged; ZSA requires confirmed winners and source-group provenance that legacy draw rows do not contain.
- Preserve triplets as evidence sets within named-game frequency groups, and save source records plus pipe-confirmed winners through one atomic RPC so failures cannot leave partial imports.

## Shared testing access
- The account-free testing workspace intentionally permits anonymous read/write access to the existing shared analysis and historical-data tables; keep this open only while shared testing is requested because anyone with the app link can change shared records.
