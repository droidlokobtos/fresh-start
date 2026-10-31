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

- Keep the existing static Raízes interface; its public Cloud adapter uses anonymous REST requests with build-provided public configuration from the same-origin parent route, so no auth sessions or secrets enter shared-tree requests.
- Persist shared-tree data by INSERT only; keep the original localStorage archive untouched, and migrate local records only through an explicit additive synchronization action to prevent silent replacement of existing data.
- Derive ancestry only from explicit parent-child links; partnership-child associations provide relationship context, never implicit parentage.
