# Contributing

Conventions for the three testers working in this repository. The aim is that
any of us can pick up anyone else's test six months from now and know what it
does and why.

---

## Branching

`main` is protected: no direct pushes, PR with passing checks required.

Branch from `main`, one branch per piece of work:

```
feat/checkout-guest-journey       new tests or framework capability
fix/pdp-price-locator             fixing a broken or flaky test
chore/upgrade-playwright          dependencies, tooling, CI
docs/erp-transaction-codes        documentation only
```

Keep branches short-lived. A branch that lives for two weeks will spend its last
three days being rebased.

---

## Commits

Write the message for the person who runs `git log` in a year:

```
Add guest checkout smoke test for all three sites

Covers the happy path through to order confirmation. Uses the placeOrder
flow as setup rather than re-walking checkout, so ERP tests can reuse it.

Address finder locators confirmed against Goldsmiths UAT.
```

Present tense, imperative first line, under ~70 characters. Explain **why** in
the body when it is not obvious. Do not commit `.env`, screenshots, traces, or
`test-results/`.

---

## Before you open a PR

```bash
npm run verify        # typecheck + lint + format check
npm run test:smoke    # smoke suite still green
```

Run the tests you touched against **all three sites**, not just the one you were
looking at — the entire point of the design is that a test works everywhere.

---

## Pull requests

Keep them small. One journey, or one page object, or one fix.

In the description, say:

- what the change covers
- which sites you ran it against, and the result
- any locator you had to guess, and why
- any open item it depends on

Every PR needs one approval from another tester. Review each other's work
properly — a rubber-stamp on a flaky test costs everyone a week later.

### What a reviewer should look for

- Does the spec contain any selector or URL? (It must not.)
- Does the page object contain any assertion? (It must not.)
- Are new locators following the preference order, and are guesses marked `TODO`?
- Is there exactly one depth tag (`@smoke` or `@regression`) plus area tags?
- Does the test create UAT data? If so, is it recorded via the run artefact helpers?
- Would this test fail for a clear reason, or a confusing one?

---

## Test conventions

**Titles read as behaviour**, and carry their tags:

```ts
test('should apply free delivery over threshold @regression @cart', …)
test('should show a price on the PDP @smoke @browse', …)
```

Not `test('cart test 3')`.

**Tags**: exactly one of `@smoke` / `@regression`, plus area tags
(`@cart`, `@checkout`, `@browse`, `@account`, `@erp`, `@mobile`, `@data-check`).
Use `@wip` for anything not ready — it is excluded from all CI runs.

**Structure**: import only from `src/fixtures/test.ts`. Use `flows/` for setup
that is not the thing under test. Assertions live in specs, never in page
objects.

**Waiting**: no `page.waitForTimeout()` — lint will reject it. Use web-first
assertions (`await expect(locator).toBeVisible()`) which retry automatically. In
the ERP suite use `waitForRoundTrip()`.

**Never** wrap an assertion in `try/catch` to stop it failing. If a test is
flaky, fix the synchronisation or delete the test — do not hide it.

---

## Locators

Preference order, always:

1. `getByRole` / `getByLabel` / `getByText`
2. `data-testid`
3. Stable CSS
4. XPath — last resort, must carry a comment explaining why

**If you have not seen the real DOM, do not invent a locator.** Write the method
and leave `// TODO: confirm locator`, or throw a clear "not implemented" error.
A plausible-looking guess that silently matches the wrong element produces a
test that passes for the wrong reason — the most expensive kind of bug in a test
suite.

Tag new entries in `src/utils/selectors.ts` with `[VERIFIED]`, `[ASSUMED]` or
`[TODO]` so the next person knows what they are trusting.

---

## Working on the ERP suite

Read section 9 of the requirements pack first, and the ERP section of the README.

Additional rules:

- Never point at production ERP. The guard blocks it; do not work around the guard.
- Keep the ERP suite **deliberately small and high-value**. It is expensive to maintain.
- Every ERP page object navigates via `runTransaction()`, never the menu tree.
- Every action that hits the server is followed by `waitForRoundTrip()`.
- Use `src/utils/sapLocators.ts` helpers — never a generated ID like `M0:46:1:2:1::0:0`.
- Check the status bar after state-changing actions. A red message is a failure.
- If you leave a document locked, say so — the next run will fail on it.

Run the ERP suite locally with `npm run test:erp`. It uses a single worker by
design; do not increase it.

---

## Adding a dependency

Ask first. This suite is run by three people and by CI, and every dependency is
something that can break a Monday morning. Playwright covers most needs already.
