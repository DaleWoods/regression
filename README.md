# WOSG UK — Playwright Automation Framework

End-to-end test automation for the three UK Spartacus storefronts —
**Goldsmiths**, **Mappin & Webb**, **Watches of Switzerland** — plus back-office
actions driven through the **SAP GUI for HTML (Webgui)** ERP.

> **Status: foundations.** This is a working, proven skeleton — structure,
> config, fixtures, CI, and one thin end-to-end proof per layer. It is not the
> full test suite. See [Open items](#open-items) for what must be confirmed
> before the suite is grown.

---

## Contents

- [Quick start](#quick-start)
- [Running tests](#running-tests)
- [Seeing tests run](#seeing-tests-run)
- [How the multi-site design works](#how-the-multi-site-design-works)
- [Repository layout](#repository-layout)
- [Writing a test](#writing-a-test)
- [Adding a page object](#adding-a-page-object)
- [Adding a site](#adding-a-site)
- [The SAP ERP suite](#the-sap-erp-suite)
- [Test data](#test-data)
- [Safety guards](#safety-guards)
- [CI](#ci)
- [Open items](#open-items)

---

## Quick start

Requires **Node 20+**.

```bash
git clone <repo-url>
cd wosg-uk-playwright

npm ci                       # install dependencies (uses the committed lockfile)
npx playwright install       # download browsers

cp .env.example .env         # then fill in the values — see below
```

Open `.env` and supply, at minimum, the three storefront base URLs. Every key is
documented in `.env.example`. **Never commit `.env`.**

Verify the setup:

```bash
npm run verify               # typecheck + lint + format check
npm run test:smoke           # smoke suite against all three sites
```

If an environment variable is missing, the run stops immediately and names the
key — it does not fail later on a timeout.

---

## Running tests

| Command                     | What it runs                         |
| --------------------------- | ------------------------------------ |
| `npm run test`              | Everything, all three sites          |
| `npm run test:goldsmiths`   | Goldsmiths only                      |
| `npm run test:mappin-webb`  | Mappin & Webb only                   |
| `npm run test:wos`          | Watches of Switzerland only          |
| `npm run test:smoke`        | `@smoke` across all three sites      |
| `npm run test:regression`   | `@regression` across all three sites |
| `npm run test:mobile`       | `@mobile` tests at a mobile viewport |
| `npm run test:data-check`   | Fixed-product integrity check        |
| `npm run test:erp`          | SAP Webgui suite (single worker)     |
| `npm run test:browserstack` | Opt-in BrowserStack device run       |

Filter by tag with `--grep`:

```bash
npm run test -- --grep @checkout
npm run test -- --grep "@smoke|@cart"
npm run test -- --grep-invert @wip
```

### Tags

Every test carries **exactly one depth tag** (`@smoke` or `@regression`) plus
area tags.

`@smoke` `@regression` `@checkout` `@cart` `@browse` `@account` `@erp`
`@mobile` `@data-check` `@wip`

`@wip` is excluded from all CI runs.

---

## Seeing tests run

The team is expected to watch and step through tests, not just read pass/fail.

**UI Mode — the primary local run method.** Watch mode, a time-travel timeline,
a DOM snapshot at every step, and a locator picker:

```bash
npm run test:ui
```

**Headed mode** — a real visible browser:

```bash
npm run test:headed
```

**Debug mode** — steps through with the Playwright Inspector:

```bash
npm run test:debug
```

**Trace Viewer** — the primary tool for diagnosing a CI failure. Traces are
captured on first retry (`trace: 'on-first-retry'`). Download the trace artefact
from the failed Actions run, then:

```bash
npm run trace path/to/trace.zip
```

**Recording locators** — generates code as you click, useful for exploring an
unfamiliar page:

```bash
npm run codegen https://goldsmiths-uat.thewosgroup.com
```

Treat generated locators as a **starting point**, not as final code — codegen
prefers whatever it finds, which is often not the most stable option. Rewrite to
follow the [locator preference order](#locator-strategy).

**VS Code extension.** Install the recommended extensions (VS Code will prompt
from `.vscode/extensions.json`). The Playwright extension adds a green run
arrow beside each test, "Record new test", and "Pick locator" in the Testing
sidebar. `.vscode/settings.json` enables browser reuse so repeated runs are fast.

---

## How the multi-site design works

The three storefronts are near-identical, so **a test is written once and runs
against all three via configuration** — never by copy-pasting spec files.

The mechanism is Playwright **projects**:

```
playwright.config.ts   defines a project per site, each setting `siteKey`
        ↓
siteFixture.ts         turns `siteKey` into a typed `SiteConfig`
        ↓
test.ts                injects page objects already bound to that config
        ↓
your spec              receives `pdpPage`, `site`, … and knows nothing about URLs
```

A spec never imports a page class, never contains a selector, and never
hard-codes a URL.

### Handling site differences

Use the **feature flags** in each site config, guarded with `test.skip()`:

```ts
test('should offer V12 finance on eligible products @regression @browse', async ({
  pdpPage,
  site,
}) => {
  test.skip(!site.features.financeV12, 'V12 finance is not enabled on this site');
  // …
});
```

Do **not** branch inside page methods (`if (site.key === 'wos') …`). If a page
genuinely diverges, subclass the page object for that site instead.

---

## Repository layout

```
config/                environment + site configuration, guards, global setup
  environments.ts        the env × site matrix
  productionGuard.ts     hard blocklist — refuses to run against production
  sites/                 one typed SiteConfig per storefront

src/
  pages/                 page objects — actions and getters, NO assertions
    BasePage.ts            goto, cookie dismissal, common waits
    storefront/            Home, Plp, Pdp, Cart, Checkout, Login, Register, Account
    erp/                   SAP Webgui pages + ErpBasePage
  components/            cross-page fragments (Header, Footer, CookieBanner, MiniCart)
  flows/                 composed, assertion-free journeys used as SETUP
  fixtures/              test.ts — the only import specs use
  data/                  fixed products, fresh-account factory
  utils/                 waits, logger, selectors, sapLocators, run artefacts

tests/
  storefront/            smoke, browse, cart, checkout, account
  erp/                   dispatch, cancellation, exchange, stock

scripts/tasks/          standalone ERP process tasks (npm run task:*)
```

---

## Writing a test

Import **only** from `src/fixtures/test.ts`:

```ts
import { test, expect } from '../../../src/fixtures/test.js';

test.describe('Shopping bag', () => {
  test('should apply free delivery over the threshold @regression @cart', async ({
    pdpPage,
    cartPage,
  }) => {
    await pdpPage.gotoProduct('/p/1234567');
    await pdpPage.addToBag();
    await pdpPage.miniCart.viewShoppingBag();

    await cartPage.waitUntilReady();
    expect(await cartPage.getItemCount()).toBe(1);
  });
});
```

Rules enforced by lint and review:

- Spec titles read as behaviour: `should apply free delivery over threshold @regression @cart`.
- Specs contain **assertions and intent only** — no selectors, no URLs.
- Page objects contain **no assertions**.
- No `page.waitForTimeout()` — banned by an ESLint rule. Use web-first
  assertions, or `waitForRoundTrip()` in the ERP suite.
- No `try/catch` wrapped around an assertion to make it pass.
- Files: `PascalCase.ts` for classes, `kebab-case.spec.ts` for specs.

---

## Adding a page object

1. Create the class under `src/pages/storefront/` (or `erp/`), extending
   `BasePage` (or `ErpBasePage`).
2. Give it a one-line JSDoc header stating which page it models.
3. Declare locators as `readonly` private fields, built in the constructor.
4. Expose **actions** (`addToCart()`) and **getters** (`getPrice()`). No assertions.
5. Register it as a fixture in `src/fixtures/test.ts` so specs receive it.

### Locator strategy

In order of preference:

1. `getByRole` / `getByLabel` / `getByText`
2. `data-testid`
3. Stable CSS
4. XPath — last resort only, and it must carry a comment explaining why

Never use CSS classes that look auto-generated or Spartacus-internal.

**Where the real DOM has not been inspected, leave `// TODO: confirm locator`
rather than inventing something plausible.** A guessed locator that happens to
match produces a test that passes for the wrong reason, which is worse than one
that fails honestly. Selectors in `src/utils/selectors.ts` are tagged
`[VERIFIED]`, `[ASSUMED]` or `[TODO]` so their provenance is never in doubt.

> **Known gap:** the storefront has very few `data-testid` attributes. A dev
> ticket should be raised to add them to the PDP and checkout CTAs. Until then
> several locators rely on bespoke `sp*` classes — stable in practice, but not a
> contract.

---

## Adding a site

1. Create `config/sites/<new-site>.ts` exporting a typed `SiteConfig`, following
   an existing file.
2. Add the site key to `SiteKey` in `config/types.ts`.
3. Add the resolver to `getSiteConfig()` in `config/environments.ts`.
4. Add a project (and a `-mobile` project if needed) in `playwright.config.ts`.
5. Add the base URL variable to `.env.example`, your `.env`, and GitHub Secrets.
6. Add a product entry per characteristic in `src/data/products.ts`.
7. Add an npm script, and extend the nightly workflow matrix.

---

## The SAP ERP suite

Automating SAP GUI for HTML is materially harder and more maintenance-heavy than
the storefront. Read section 9 of the requirements pack before working on it.
The essentials:

**Single worker, always.** The ERP project runs `workers: 1`. SAP enforces
server-side object locks and a per-user concurrent session limit (commonly six).
Parallel workers produce lock errors and "maximum number of sessions" failures
that look like test bugs but are not. Parallelism would require **one dedicated
SAP QA user per worker** — not more sessions for one user.

**Navigate with the OK code field, never the menu tree.** `runTransaction('VA02')`
types `/nVA02` into the command box. The Easy Access menu is slow, deeply nested,
and breaks whenever a role changes.

**Never use generated IDs.** Unified Rendering emits positional IDs like
`M0:46:1:2:1::0:0` that change on any layout change. Use the helpers in
`src/utils/sapLocators.ts`, which prefer the `title` attribute, then the `ct`
control-type attribute plus a nearby label.

**Always wait for the round trip.** Webgui replaces large parts of the DOM on
every server round trip, so locators go stale constantly. Call
`waitForRoundTrip()` after every action that hits the server. It waits for the
busy indicator to clear and re-resolves the content frame.

**Read the status bar.** SAP reports success and failure in the status bar, not
by navigating. `getStatusMessage()` returns `{ type, text }`; a red (E/A) message
is a failure even when the screen looks fine.

**ALV grids are virtualised.** Only visible rows exist in the DOM. Never assert
across "all rows" — filter down to one row using SAP's own selection fields,
then use `findRowByCellText()`.

### Process tasks

Some ERP automation is a _test_; some is a _process task_ run to set up other
testing. Process tasks are callable both from specs and from the CLI:

```bash
npm run task:dispatch-order -- --delivery 80001234
npm run task:move-stock -- --material 123456 --quantity 1 \
  --from-plant 1000 --from-location 0001 \
  --to-plant 2000 --to-location 0001 --movement-type 311
```

### Transaction codes

⚠️ **All transaction codes are unconfirmed.** They live in
`src/pages/erp/transactionCodes.ts` as standard-SAP assumptions. WOSG very
likely uses bespoke `Z*` transactions for some of these.

| Action                              | Assumed t-code               | Confirmed |
| ----------------------------------- | ---------------------------- | --------- |
| Dispatch / goods issue              | `VL02N` (`VL06O` collective) | ☐         |
| Order change / cancel / reject line | `VA02`                       | ☐         |
| Exchange / returns order            | `VA01` (returns type)        | ☐         |
| Stock transfer between locations    | `MB1B` / `MIGO`              | ☐         |
| Stock overview (verification)       | `MMBE`                       | ☐         |
| Order display                       | `VA03`                       | ☐         |

Update this table and `transactionCodes.ts` once the SAP team confirms them.

---

## Test data

**Products — fixed and pre-seeded.** `src/data/products.ts` holds a curated set
per site, keyed by characteristic (`inStockSimple`, `outOfStock`, `highValue`,
`financeEligible`, …) rather than by SKU, so a swapped SKU does not ripple
through the suite.

⚠️ **All SKUs are currently placeholders.** The `@data-check` suite fails until
they are confirmed — that failure is the tracked reminder, and it turns green as
soon as the catalogue is filled in.

**Accounts — fresh per run.** `userFactory.ts` generates unique addresses
(`qa.auto+<timestamp>-<uuid>@<domain>`). Never reuse a shared login for a test
that mutates account state.

**Payments.** Card values come from environment variables only, never code.

**Cleanup.** Automated cleanup of UAT does not exist yet, so every created
account, order and ERP document is appended to `artifacts/created-data.jsonl`
and uploaded by CI — data build-up stays visible, and whoever writes the cleanup
job gets an exact list.

---

## Safety guards

Two guards run in global setup, before any browser launches.

**Missing environment variables** are reported together, by name, with what to
do about each.

**Production targets are refused outright.** `config/productionGuard.ts` blocks
known live hostnames _and_ fails closed on any host that lacks a recognised
non-production marker (`uat`, `staging`, `qa`, `test`, …). The ERP host is
covered explicitly. The framework exits rather than running.

This is not decoration: this suite places orders and posts goods issues. Against
a live system it would create real orders and move real stock.

---

## CI

**`pr-checks.yml`** — on every PR: typecheck, lint, format check, then `@smoke`
against Goldsmiths on Chromium. Reports and traces are uploaded as artefacts.
Must pass before merge.

**`nightly.yml`** — scheduled 02:00 UTC: `@regression` plus `@data-check` across
all three sites in parallel, `fail-fast: false` so one site failing still gives
a verdict on the others.

All credentials come from **GitHub Secrets**. Required secrets:

```
GOLDSMITHS_BASE_URL_UAT     MAPPIN_WEBB_BASE_URL_UAT     WOS_BASE_URL_UAT
TEST_USER_EMAIL_DOMAIN      TEST_USER_PASSWORD
PAYMENT_CARD_NUMBER         PAYMENT_CARD_EXPIRY          PAYMENT_CARD_CVC
```

### Branch protection on `main`

To be configured in repository settings: no direct pushes, PR required, PR
checks required to pass, and all three testers added as collaborators with write
access.

---

## Open items

These block growing the suite and should be resolved before the next phase.

- [ ] Confirm the ERP transaction codes actually used at WOSG — standard vs bespoke `Z*`
- [ ] Confirm whether the QA SAP user is shared, and its concurrent session limit
- [ ] Confirm the ERP backend version / SP level — affects Unified Rendering behaviour
- [ ] Confirm the UAT payment method for the happy path, and test card details
- [ ] Confirm the fixed product SKUs per site
- [ ] Confirm the BrowserStack device matrix
- [ ] Confirm the CI failure notification target (Slack channel? email?)
- [ ] Confirm whether UAT has a test-data reset cadence that would invalidate fixed products
- [ ] Decide whether ERP process tasks need access controls beyond repo access
- [ ] Raise a dev ticket for `data-testid` attributes on PDP and checkout CTAs
- [ ] Confirm the category taxonomy paths on Mappin & Webb and Watches of Switzerland

Resolved:

- [x] ERP rendering confirmed as SAP GUI for HTML (Webgui), not Fiori
