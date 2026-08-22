# Contributing

Thanks for considering a contribution. Bug reports, reproductions and pull
requests are all welcome.

## Getting set up

Node 24 or newer, and pnpm (the repo has a `pnpm-lock.yaml`):

```sh
git clone https://github.com/filipebraida/adonis-inertia-modal.git
cd adonis-inertia-modal
pnpm install
```

That is the whole setup — the test suite runs a DOM under Node via
`@happy-dom/global-registrator`, so there is no browser or example app to
boot for the automated checks.

## The checks

```sh
npm run quick:test   # the suite, no coverage — what you want while iterating
npm test             # lint + suite + coverage report
npm run lint         # eslint (includes prettier)
npm run format       # prettier --write, fixes most lint complaints
npm run typecheck    # tsc --noEmit
npm run build        # tsdown bundle + declarations
```

CI runs lint, typecheck and the suite on Ubuntu and Windows. Run
`npm run lint` and `npm run quick:test` before pushing and you will rarely be
surprised.

While iterating, filter instead of running everything:

```sh
npm run quick:test -- --files="vue"
npm run quick:test -- --groups="vue | portal container"
npm run quick:test -- --tests="opens a modal from within a modal (stacked)"
npm run quick:test -- --failed
```

## How the package is laid out

```
src/                    server side: ModalResponse, prop resolution, headers
src/client/core/        framework-agnostic client: stack, config, prefetch, history
src/client/react/       React adapter
src/client/vue/         Vue 3 adapter
providers/              the AdonisJS provider that adds inertia.modal()
tests/                  Japa specs, mirroring the layout above
```

Two things worth knowing before you change client code:

**React and Vue are expected to stay at parity.** The README states that every
feature works the same in both. A feature landing in one adapter should land in
the other, with the same behaviour and mirrored tests — or the README claim
needs adjusting in the same PR.

**The modal envelope is not the Inertia page object.** Server-side props travel
nested under a shared `modal` prop, so anything Inertia signals through
top-level page fields (`onceProps`, `scrollProps`, `mergeProps`,
`matchPropsOn`, …) has nowhere to go. `src/resolve_modal_props.ts` rejects
those wrappers with an explicit error rather than dropping them silently. If
you are adding support for a new Inertia prop wrapper, that file is where the
decision gets made.

## Tests

Every behaviour change wants a test. The suite uses
[Japa](https://japa.dev) with `@japa/assert`; client tests use
`@testing-library/react` and `@vue/test-utils`.

A test that guards against a regression should **fail without your fix**.
Check it: stash the source change, run the test, confirm it goes red, restore.
It is the difference between a test that documents the fix and one that only
documents that the code runs.

## Commits and pull requests

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
— `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`, with an optional
scope (`fix(client):`, `feat(vue):`) and `!` for a breaking change. The
changelog is written from them.

Explain _why_ in the body, not just what. The diff already shows what changed;
what it cannot show is the reasoning that makes the change reviewable.

PRs are integrated by rebase onto `main`, so your branch may be replayed rather
than merged with the button. Your authorship is preserved. GitHub will show the
PR as closed rather than merged — that is the rebase, not a rejection.

## Verifying against a real app

The automated suite covers behaviour, but the package's whole point is what
happens inside a running AdonisJS + Inertia app. For changes to rendering,
transitions, focus or the browser's top-layer, it is worth checking in a real
one: scaffold an AdonisJS 7 app with the Inertia starter kit, then point it at
your checkout with `pnpm link` (or `npm i /path/to/adonis-inertia-modal`).

There is no example app committed to this repo, so mention in your PR what you
verified by hand and how.

## Reporting bugs and asking questions

Open an issue — the bug and feature templates ask for what is usually needed.
Usage questions are welcome as blank issues; there is no separate forum.

A reproduction beats a description. The most useful report names the versions
(`adonis-inertia-modal`, `@adonisjs/inertia`, `@inertiajs/*`), says whether it
is React or Vue, and shows the controller returning the modal alongside the
component receiving it.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](./LICENSE.md).
