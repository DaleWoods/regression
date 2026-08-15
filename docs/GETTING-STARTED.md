# Getting started — what to do, in order

A practical checklist for Dale, split by what needs the software installed and
what doesn't.

---

# PART 1 — Do now, while waiting for IT

None of this needs Node.js or VS Code. **This is the part that actually determines
whether the suite is useful**, so it is worth doing properly rather than waiting.

## 1.1 Get the two missing UAT URLs ⬅ highest priority

I only have one confirmed hostname, taken from your Selenium code:

- **Goldsmiths:** `https://goldsmiths-uat.thewosgroup.com` ✅ confirmed
- **Mappin & Webb:** `?` — I guessed `mappinandwebb-uat.thewosgroup.com`
- **Watches of Switzerland:** `?` — I guessed `watches-uat.thewosgroup.com`

Open the two sites in Chrome and copy the real addresses from the address bar.
Without these, only one of the three site projects can run.

## 1.2 Collect the fixed product SKUs

This is the biggest single blocker to the suite being useful, and it is pure
browser work. The framework needs **six products per site**, chosen by
characteristic rather than at random, so a test can say "give me an in-stock
product" and stay correct when the SKU changes.

For each, note the **SKU**, the **exact product name** as displayed, and the **URL
path** (everything after the domain, e.g. `/p/1234567`).

| Characteristic            | What it needs to be                                | Goldsmiths | Mappin & Webb | WoS |
| ------------------------- | -------------------------------------------------- | ---------- | ------------- | --- |
| `inStockSimple`           | Plain in-stock product, no size/variant choice     |            |               |     |
| `inStockVariant`          | In-stock product **with** a size or variant picker |            |               |     |
| `outOfStock`              | Genuinely out of stock                             |            |               |     |
| `highValue`               | Expensive — for any value-threshold behaviour      |            |               |     |
| `financeEligible`         | Shows the V12 finance option                       |            |               |     |
| `clickAndCollectEligible` | Offers Click & Collect                             |            |               |     |

Pick products likely to stay stable in UAT — avoid anything seasonal or on
clearance. Send me the completed table and I'll load it into the framework.

## 1.3 Check the category paths on the other two sites

The one category path I have is from Goldsmiths: `/c/Watches/Mens-Watches`.

Browse to men's watches on Mappin & Webb and Watches of Switzerland and check
whether the URL path is the same. If they differ, note what they are. The first
smoke test uses this path, so a difference here is the most likely early failure.

## 1.4 Chase the questions that need other people

These take the longest because they depend on someone else replying. Start them now.

**To the SAP team:**

- Which transaction codes do we actually use for: dispatch/goods issue, order
  cancellation, returns/exchange, stock transfer between locations, stock
  overview? I have assumed the standard SAP codes (VL02N, VA02, VA01, MB1B, MMBE)
  but WOSG may well use bespoke `Z*` transactions.
- Is SAP GUI for HTML (Webgui) enabled on the QA system, and what is its URL? You
  have the Windows desktop client installed, which is a different route in.
- Can we have a dedicated QA user for automation? **Is it shared with anyone, and
  what is its concurrent session limit?** The automation is designed around this.

**To whoever owns UAT / payments:**

- What is the default payment method for the happy-path checkout in UAT, and which
  test card should we use?
- Does UAT get refreshed or reset on a schedule? If so, our fixed products may be
  wiped periodically and we need to plan for that.

**To your manager / the team:**

- Which BrowserStack devices do we care about? I've put two iOS, two Android and
  desktop Safari in as a placeholder.
- Where should overnight test failures be reported — a Slack channel, or email?

## 1.5 Sort out GitHub access

- Write access for all three testers.
- Decide where this lives. The spec says a new repository, separate from the
  existing `regression` repo. Right now the code is on a branch of `regression`
  called `claude/new-app-spec-cg45vb`. **Don't merge that branch into `main`** —
  it's meant to be lifted into its own repo. I can do that move whenever you're
  ready.

## 1.6 Optional — have a read

Git is already installed, so you can pull the code down and read it now, without
Node:

```
git clone https://github.com/DaleWoods/regression.git wosg-playwright
cd wosg-playwright
git checkout claude/new-app-spec-cg45vb
```

Open `README.md` in Notepad++. Worth skimming even if the code means nothing yet —
it explains how one test ends up running against three sites.

---

# PART 2 — The day the software lands (about 30 minutes)

## 2.1 Check the install worked

Open **Windows Terminal** and run each of these:

```
node --version
npm --version
git --version
code --version
```

Expect version numbers from all four. If any says "not recognized", it hasn't
installed properly or isn't on the PATH — go back to IT before continuing.

## 2.2 Get the code

If you already cloned it in 1.6, skip to 2.3. Otherwise:

```
git clone https://github.com/DaleWoods/regression.git wosg-playwright
cd wosg-playwright
git checkout claude/new-app-spec-cg45vb
```

## 2.3 Install the project

From inside the project folder:

```
npm ci
npx playwright install
```

The first pulls down the framework's dependencies (a minute or two). The second
downloads the test browsers (~1.5GB, longer).

**If either fails, stop and tell me the error.** Don't start changing things. The
two most likely causes on your machine are certificate errors and application
blocking, and both have specific fixes — details are in `IT-REQUEST.md`, sections
C1 and C2.

## 2.4 Create your configuration file

```
copy .env.example .env
notepad .env
```

Fill in the three URLs from step 1.1:

```
TEST_ENV=uat
GOLDSMITHS_BASE_URL_UAT=https://goldsmiths-uat.thewosgroup.com
MAPPIN_WEBB_BASE_URL_UAT=<the real one>
WOS_BASE_URL_UAT=<the real one>
TEST_USER_EMAIL_DOMAIN=thewosgroup.com
TEST_USER_PASSWORD=<any strong password — used for accounts the tests create>
```

All three URLs must be filled in, even to run one site. Save and close.

`.env` is deliberately excluded from source control — never commit it.

## 2.5 Check the framework is healthy

```
npm run verify
```

This checks the code compiles and is correctly formatted. It should pass silently.
It doesn't touch the network, so it working confirms the install is sound.

## 2.6 First real run

Start with one site:

```
npm run test:goldsmiths -- --grep @smoke
```

Five tests. Expect it to take under a minute.

Then all three:

```
npm run test:smoke
```

## 2.7 Look at it properly

```
npm run test:ui
```

This is the one worth spending time in. Click a test, hit the green arrow, then
use the timeline at the top to step through — you get a snapshot of the page at
every step, with the element the test was looking at highlighted.

---

# PART 3 — What "done" looks like for the first milestone

You've succeeded when `npm run test:smoke` is green across all three sites. At that
point the whole chain is proven: configuration, the three-site mechanism, page
objects, and the browser.

**Expect some failures on the first run.** That's normal and useful. The likely ones:

| Symptom                                  | Probable cause                                            |
| ---------------------------------------- | --------------------------------------------------------- |
| Goldsmiths passes, other two fail on PDP | Category path differs between sites — see 1.3             |
| Cookie banner assertion fails            | OneTrust behaves differently on that site                 |
| Everything fails to reach the site       | UAT not reachable from your machine, or needs VPN         |
| Tests can't find the header              | Site markup differs from what the Selenium code suggested |

Send me whatever fails, with the error, and I'll fix it. Do not start editing
locators yourself yet unless you want to — several are deliberately marked
`TODO: confirm locator` rather than guessed, and I'd rather correct them from real
evidence than have us both guessing.

**`@data-check` will fail, and that's intentional.** It lists the placeholder SKUs
and will keep failing until the real ones from 1.2 are loaded. It's the tracked
reminder, not a bug.

---

# PART 4 — After that

Roughly in order:

1. Load the real SKUs and get `@data-check` green.
2. Build out the storefront suite — cart, checkout, account journeys — using the
   page objects that are already scaffolded.
3. Move the code into its own repository and set up branch protection on `main`.
4. Turn on the GitHub Actions workflows so tests run on pull requests and overnight.
5. Wire in BrowserStack once the device list is agreed.
6. Start the ERP work, once the SAP questions from 1.4 come back.

The ERP part is deliberately last. It's the hardest and most fragile, and it needs
answers from the SAP team before it's worth touching.

---

## The short version

**Now:** get the two UAT URLs, collect eighteen SKUs, email the SAP team.

**When it's installed:** `npm ci`, `npx playwright install`, fill in `.env`,
`npm run test:smoke`.

**Then:** send me what breaks.
