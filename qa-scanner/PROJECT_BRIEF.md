# Project Brief: Multi-Brand QA Scanner

*A plain-English summary for non-technical readers.*

---

## 1. The problem

Our three retail websites — **Goldsmiths**, **Mappin & Webb** and **Watches of Switzerland** — together list tens of thousands of product pages. Every page has a title, a description, a set of photos, a price, a stock status and a "product details" table.

Mistakes on any of these cost money or trust:

- A product titled "9ct **White** Gold" whose details table says "**Yellow** Gold".
- A broken or missing product photo, or the same photo used on two different products.
- A page with no price, or one that says "in stock" when the Add to Bag button is switched off.
- A US spelling ("color") on a UK site.
- A watch that says "40mm" in the title and "42mm" in the description.

Nobody can read 30,000 pages by hand, and these errors are exactly the kind that get noticed by customers first. Before this tool, mistakes were mostly found by chance — for example, one team member happened to spot the white/yellow gold mismatch while browsing.

## 2. The solution

An internal website, protected by a password, where a team member picks a brand, presses **Run scan**, and gets back a ranked list of what is wrong and on which product. It checks every page the same way, every time, and tells you exactly what to go and fix.

A second, smaller tool in the same project — an automated "robot shopper" — walks through a real purchase (browse → add to bag → checkout → pay → order confirmation) and checks the website's analytics tracking, so a broken checkout is caught before customers hit it.

## 3. How it works, step by step

1. **Pick a brand.** One tab per brand; each shows the results of its last scan immediately, shared by everyone on the team.
2. **(Optional) Upload the "sellable list".** This is the product feed from Google Merchant. It tells the scanner which products are approved and for sale, and which are in stock right now.
3. **The scanner reads the site's product list** (its sitemap) to find every product page.
4. **It puts the most important pages first:** in-stock products that are for sale, then other for-sale products, then everything else. Nothing is skipped; only the order changes.
5. **It checks each page.** It first tries a quick, lightweight read of the page; only if that isn't reliable does it open the page in a full hidden web browser — this keeps scans fast and cheap.
6. **It applies the checks** (see list below) and records every problem found.
7. **It builds a report:** problems ranked by severity, filterable by type, with clickable links straight to the product. One product with six broken photos counts as **one** product to fix, not six.
8. **You review and act.** False alarms can be dismissed (and stay dismissed); everything else can be downloaded as a spreadsheet (CSV) to hand to the people who fix content.
9. **Big sites are scanned in batches.** The tool remembers where it got to, never re-scans the same page within a pass, and starts a fresh pass once the whole catalogue is covered.

### What it checks

| Check | In plain terms |
|---|---|
| Product photos | Does each photo load? Is any photo missing, from another product, or a duplicate? |
| Title vs. description vs. details table | Do metal, gender, movement type, case size and product type agree everywhere? |
| UK spelling and grammar | US spellings, common misspellings, repeated words |
| Page basics | Missing page title or heading; duplicate or blank search-engine description |
| Price and stock | Missing/zero price, wrong currency, "was" price lower than "now" price, stock status that contradicts the Add to Bag button |
| Optional AI review | Subtler wording contradictions, sent to Claude (costs per page, off unless switched on) |

Most checks are fixed rules, not AI — so they are free, fast, and give the same answer every time.

## 4. Tools involved

| Tool | What it does here |
|---|---|
| Node.js | Runs the scanner and the dashboard website |
| Playwright / Chromium | A hidden web browser used when a page needs full rendering |
| Anthropic Claude (optional) | Reads copy for subtle contradictions |
| Google Merchant feed | Source of the "sellable / in stock" list |
| Render + Docker | Hosts the dashboard online with a saved disk for results |
| Java, Selenium, JUnit | The "robot shopper" test suite |
| GitHub | Stores the code |

## 5. Results and numbers worth showing

**Verified facts about what exists:**

| Number | What it means |
|---|---|
| **3** | Brands covered (Goldsmiths, Mappin & Webb, Watches of Switzerland) |
| **5,000** | Products in the Watches of Switzerland sellable list uploaded to date (the tool's current upload cap per list) |
| **6** | Kinds of check run on every page |
| **1 pass, then repeat** | Whole-catalogue coverage is tracked per brand so each sweep finds newly introduced problems |
| **2** | Automated "robot shopper" journeys: place an order, and verify product-click analytics |
| **Free** | The rule-based checks cost nothing to run; only the optional AI review is charged per page |

**A real catch.** A Goldsmiths lab-grown-diamond pendant was titled "9ct White Gold" while its details table said "Metal Type: 9ct Yellow Gold". The scanner now reports this exactly: *"Material mismatch: title says white gold, product details says yellow gold."* It was confirmed against the real page's saved source, not just a test example.

**Improvements made from real use:**

- Report filter counts now show **products affected** rather than raw line items ("Product images: 1" instead of "6").
- Google Merchant feeds upload directly (no manual conversion), and oversized files now give a readable error.
- Stock status is read from the Add to Bag button itself, which is more reliable than guessing from wording.
- Links in reports open in a new tab; in-stock products are scanned first.

## 6. Time saved — an honest note

**No time-saved figure has been measured, so none is claimed here.** A reasonable way to put a number on it:

- *Manual review:* minutes per page × number of pages (for example, at 2 minutes a page, 1,000 pages is about 33 working hours).
- *With the scanner:* the run itself is unattended; staff time is only the review of the ranked list.

If you can supply how long a manual check of one product page takes, and the size of each catalogue, the comparison can be filled in with real figures.

## 7. Current status and next steps

**Done:** dashboard for three brands, all checks above, batched and resumable scanning, dismissing false positives, CSV export, password login, cloud hosting setup, the robot-shopper checkout journey and analytics check.

**Still to do:**

- Confirm the real sitemap addresses for each brand.
- Allow-list the scanner with the site's bot protection (Akamai) so broken-link checking can be switched on.
- Add more real product examples (watches, sale items, rings) to tighten the checks further.
- Move the robot shopper's test settings out of the code and remove real-looking personal and card details from its test data.
- Add automatic scheduled runs and run the robot shopper in an automated pipeline.
- Measure time saved properly (see section 6).

*Note: the copy of the scanner stored in this repository is an earlier snapshot than the one described above; the more recent work lives in the separate `qa-scanner` repository.*
