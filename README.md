# regression

This repository holds two independent projects:

1. **The Java/Selenium/JUnit 5 UI regression suite** described in this
   document — everything under `src/`, driving real browser journeys
   through a WOSG retail site (currently the Goldsmiths UAT environment).
2. **[`qa-scanner/`](qa-scanner/README.md)** — a separate Node.js web app
   (internal QA scanner dashboard for the WOSG retail sites) with its own
   setup, configuration, and README. It doesn't share code or a build with
   the Selenium suite; see its own README for everything about it.

The rest of this document covers project (1): the Selenium suite at the
repo root. It drives real browser journeys through Page Objects — end-to-end
order placement, and analytics (GTM `dataLayer`) verification — rather than
testing components in isolation.

## 1. Requirements

### 1.1 Functional

- **Place-order journey** (`PlaceOrderTest`): browse Home → Watches →
  Men's Watches PLP → open a PDP → add to bag → mini-bag drawer → cart →
  guest checkout (email, personal details, address-finder lookup, hosted
  card payment) → order confirmation. Each row of a CSV fixture is run as
  one full journey, so the same test can place multiple orders with
  different customer/address/card data without a code change.
- **Analytics verification** (`ProductClick`): open a PLP named in a CSV
  fixture, install a listener that intercepts every `window.dataLayer.push`
  call, click a random visible product tile, and verify the resulting
  `productClick` GTM event — event name, category, session id, the
  `ecommerce.click.actionField.list`, and the clicked product's
  name/id/`fr_product_id`/`source_id`/price/brand/position — cross-checked
  against what the PDP itself renders (title, URL article id, displayed
  price), not just against the event's own internal fields.
- **Failure diagnostics**: any test, setup, or teardown failure captures a
  screenshot (`ScreenshotWatcher`) and, for the analytics test specifically,
  dumps the tail of both `window.dataLayer` and the intercepted-event
  buffer so a failure is diagnosable from the JUnit report alone.

### 1.2 Non-functional / environment

- Java 17 (Gradle toolchain-pinned — a matching JDK is fetched automatically
  via the `foojay-resolver` plugin if one isn't already installed).
- Gradle wrapper (`./gradlew`) — no local Gradle install required.
- Chrome, driven by Selenium 4's built-in Selenium Manager (no manual
  ChromeDriver download/version-matching).
- JUnit 5 (Jupiter) as the test engine, with the JUnit Platform HTML report
  enabled.
- No test-management/CI system is wired up yet (see §4).

## 2. Architecture

### 2.1 Layout

```
src/main/java/regression/
  pages/            Page Objects — one class per page or reusable page
                     component (drawer, iframe-based payment block, ...)
  utils/            Cross-cutting helpers used BY page objects: waits,
                     CSV parsing, cookie-consent dismissal, driver creation

src/test/java/regression/
  tests/            JUnit test classes, shared TestBase, ScreenshotWatcher
  tests/analytics/  Analytics-specific test classes (currently: product click)
  analytics/util/   Helpers specific to dataLayer/GTM verification —
                     deliberately separate from utils/ because they reach
                     into page JavaScript state, not page structure

src/test/resources/testdata/
                     CSV fixtures consumed by the tests above
```

Page Objects live under `main/`, not `test/`, because they describe the
site itself (locators, navigation, form-filling) and could in principle be
reused by a non-test consumer; only the JUnit classes, assertions, and
fixtures live under `test/`.

### 2.2 Design decisions and why

- **Page Object Model.** Every page/component the tests touch (`Homepage`,
  `MenWatches`, `MensWatchesPLP`, `PDP`, `MiniBag`, `Cart`, `CheckoutPage1/2/3`,
  `OrderConfirmation`) is its own class owning its own locators. Test classes
  read as a sequence of business steps (`pdp.addToBag()`, `cart.checkoutSecurely()`)
  rather than raw Selenium calls, so a markup change is a one-file fix
  instead of a hunt through every test that happens to touch that page.

- **Locator fallback chains, not single locators.** Several Page Objects
  (`Homepage.goToWatches`, `MenWatches.goToMensWatchesPLP`,
  `CheckoutPage2`'s address-finder locators, `CheckoutPage3`'s pay-button
  candidates) try a specific, structure-based locator first and fall back
  to a looser, text- or attribute-based one. This is a deliberate tolerance
  for a site whose markup and class names are expected to drift release to
  release — the alternative (one brittle locator per element) would turn
  every unrelated front-end change into a test failure.

- **Click via native `WebElement.click()`, with a JS-click fallback.**
  Every interactive action (`safeClick`/inline try-catch patterns
  throughout the Page Objects) tries a real click first and falls back to
  `((JavascriptExecutor) driver).executeScript("arguments[0].click();", el)`
  only on `ElementClickInterceptedException`/`JavascriptException`. Native
  click is kept as the default (it's what a real user does, and some
  handlers only fire on trusted events); the JS fallback exists because
  sticky headers, consent banners, and mid-animation overlays intercept
  clicks on this site in practice.

- **`document.readyState === 'complete'` as the page-load signal**
  (`WaitUtils.waitForPageLoad`), backed by explicit `WebDriverWait`s for
  specific elements everywhere else. No blanket `Thread.sleep` waits except
  a few short, explicitly-commented settle pauses (drawer animation,
  order-confirmation dwell) — the intent is that every wait names the
  condition it's actually waiting for.

- **Selenium Manager over a manually managed driver binary.**
  `DriverFactory` calls `new ChromeDriver(options)` directly and relies on
  Selenium 4.6+'s built-in driver resolution, so there's no
  `webdriver.chrome.driver` path to keep in sync with the installed Chrome
  version. Headless mode and whether to keep the browser open after a
  failure are both plain JVM system properties (`-Dheadless=true`,
  `-DkeepBrowser=true`) rather than a config file — the simplest thing that
  lets a developer flip either from the command line without editing code.

- **CSV-driven data, not `@ParameterizedTest` / `@CsvSource`.**
  `CsvReader` is a small hand-rolled reader (comma-or-semicolon delimiter,
  blank-line skipping, per-field trim) rather than JUnit's built-in CSV
  support, so a QA engineer can add or remove an order/PLP scenario by
  editing a file in `testdata/` with no Java or annotation knowledge
  required, and a single test method drives an arbitrary number of rows.

- **Hosted-field (iframe) payment handling.** `CheckoutPage3` treats the
  card number/expiry/CVC fields as living inside separate, independently-
  mounted iframes (an Adyen-style hosted-fields integration): each field is
  reached via `switchToIframeWhenReady`, filled, then the driver switches
  back to `defaultContent()` before touching the next one or the pay
  button. Field locators are tried as a short-timeout candidate list rather
  than one long wait per candidate, specifically to avoid stacking up
  30-second waits when only the first candidate in the list is ever
  actually present.

- **`dataLayer.push` monkey-patching, not network interception.** GTM
  events are read by wrapping `window.dataLayer.push` in JavaScript
  (`installDataLayerListener`/`installDataLayerListenerOnPlp`) so every
  push is captured into `window.__dlEvents` regardless of when it fires
  relative to navigation, plus a direct poll of `window.dataLayer` itself
  on the PDP as a second source. `DataLayerWait.waitForProductClickCombined`
  checks the PDP's own `dataLayer` first and falls back to the captured
  buffer, which is what makes the test resilient to the click firing its
  analytics event *before* the browser has navigated away from the PLP.

- **Screenshot capture via a JUnit `TestWatcher` +
  `TestExecutionExceptionHandler`.** `ScreenshotWatcher` is a JUnit
  extension, not code inlined into `@AfterEach`, so it fires on a
  `@BeforeEach`/`@AfterEach` failure as well as a test-body failure, and
  finds the `driver` field via reflection on `this` — meaning it works for
  any current or future `TestBase` subclass without modification.

## 3. Test data

`src/test/resources/testdata/`:

- **`order_data.csv`** — one full order per row: `email, title, firstName,
  lastName, phone, street, city, postcode, card_number, expiry, cvv`. A
  header row is optional (detected and skipped if the first cell is
  `email`, case-insensitively). Card number is sanity-checked post-parse
  (must yield ≥14 digits after stripping non-digits) so a CSV-quoting
  mistake fails fast with a clear message instead of silently sending a
  truncated PAN. Expiry accepts several human formats (`Mar-30`, `0329`,
  `03/29`, `03-2029`, ...) and is normalised before being typed into the
  hosted field.
- **`plp_urls.csv`** — `plpUrl, expectedList`: which PLP to open and,
  optionally, the GTM `actionField.list` value expected on a product click
  from it (assertion is skipped, not failed, when `expectedList` is blank).
- **`order_scenarios_50rows_5opts_percell_show.xlsx`** — present in the
  repo but not currently read by any test; likely a source the CSV data was
  derived from, or a heavier data-driven scenario matrix awaiting a test
  that consumes it. Treat as **not yet wired up**.

> **Note:** `order_data.csv` currently contains what reads as a real name,
> email address, phone number, delivery address, and PAN/expiry/CVV rather
> than obviously-synthetic test data. Confirm this is a sanctioned
> UAT-only test card before treating it as safe to commit further copies
> of, and consider moving personally-identifying fixture data out of
> version control (environment variables, a git-ignored local file, or a
> secrets-managed test-data source) — see §4.

## 4. What's done vs. pending

### Done

- Page Object layer covering the full guest-checkout path: home → nav →
  PLP → PDP → mini-bag → cart → 3-step checkout → confirmation.
- CSV-parameterised, multi-row order placement test with resilient
  locators, JS-click fallbacks, and iframe-based hosted card-field entry.
- Analytics test validating a PLP `productClick` GTM event against both
  its own internal consistency and the PDP it actually navigated to.
- Screenshot-on-any-failure for every test class (via `TestBase` +
  `ScreenshotWatcher`), plus dataLayer/captured-buffer diagnostic dumps
  specifically for the analytics test.
- Gradle wrapper build with a pinned Java 17 toolchain and a JUnit HTML
  report.

### Pending / known gaps

- **No configuration layer.** The UAT base URL
  (`https://goldsmiths-uat.thewosgroup.com`) is a string literal inside
  `PlaceOrderTest`; `regression.utils.Env` exists but is an empty stub —
  the intended home for environment/base-URL config was never
  implemented. There's currently no way to point either test at a
  different environment or brand without editing test code.
- **Chrome only.** `DriverFactory` hardcodes `ChromeDriver`; there's no
  browser-selection mechanism (Firefox/Edge/WebKit) and no cross-browser
  run.
- **Single brand, single category.** Only Goldsmiths, and only Men's
  Watches, are exercised. Coverage doesn't extend to other brands
  (Mappin & Webb, Watches of Switzerland), other categories, or a
  non-guest (logged-in) checkout path.
- **No CI pipeline.** No GitHub Actions/other workflow runs these tests
  automatically; they're currently run locally via `./gradlew test`.
- **Fixture data includes real-looking PII/card data checked into the
  repo** (see §3) rather than generated or externally-sourced test data.
- **`order_scenarios_50rows_5opts_percell_show.xlsx` is unused** — either
  dead weight or a scenario matrix a future test should be built to read.
- **Two `Library.java` files** (`regression.Library`,
  `regression.pages.Library`) are unmodified Gradle-`init`-task boilerplate
  with a matching `LibraryTest` — not part of the actual suite and safe to
  delete once confirmed unneeded.
- **No retry or flaky-test handling** beyond the resilience built into
  individual Page Object methods (fallback locators, short internal
  retries) — a genuinely flaky step still fails the whole test run.
- **Analytics coverage is single-event.** Only `productClick` is verified;
  other GTM events the site fires (page view, add-to-cart, checkout steps,
  purchase) aren't covered yet, though `DataLayerWait`/`AssertLog` are
  written generically enough to extend to them.

## 5. Running the suite

```sh
./gradlew test                    # run everything, headed Chrome
./gradlew test -Dheadless=true    # headless Chrome
./gradlew test -DkeepBrowser=true # leave the browser open after a failure for inspection
./gradlew test --tests "regression.tests.PlaceOrderTest"
./gradlew test --tests "regression.tests.analytics.product.ProductClick"
```

Reports:

- JUnit HTML report: `build/reports/tests/test/index.html`
- Failure screenshots: `build/screenshots/<TestClass>/<method>_<timestamp>.png`

No `.env`/config file is required or read at present (see §4 — this is a
gap, not a documented setup step).
