# Agent Guidelines

`@interop/social-core` is the platform-neutral contacts data model,
normalization, import-merge, and last-write-wins rules shared by the Freewallet
mobile and web wallets, so their two contacts replicas converge on one set of
decisions instead of drifting. The last-write-wins rule (`remotePayloadWins`) is
also consumed by `@interop/was-react` and `@interop/was-sync`, so it is the
ecosystem's one LWW tiebreak rather than a contacts-only rule.

## Ecosystem conventions

- Cross-repo lessons (invariants, gotchas, and process recipes that span repos)
  live in the ecosystem learnings file,
  [byoe-ecosystem/LEARNINGS.md](https://github.com/interop-alliance/byoe-ecosystem/blob/main/LEARNINGS.md)
  (usually checked out beside this repo as `../byoe-ecosystem`); read it at the
  start of any cross-repo task.
- Cross-repo decisions are recorded as `decisions/NNNN-slug.md` in the repo that
  owns the contract; the convention and template are canonical in
  [isomorphic-lib-template's `decisions/`](https://github.com/interop-alliance/isomorphic-lib-template/tree/main/decisions).
