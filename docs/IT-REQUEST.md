# IT Request — Playwright Test Automation Environment

**Requested by:** QA / Test Automation team
**Purpose:** Set up the WOSG UK automated regression suite for the Goldsmiths,
Mappin & Webb and Watches of Switzerland UAT storefronts, plus SAP QA back-office
automation.
**Machines affected:** QA workstations (Windows 11, Intune-managed).

This request has been checked against the actual installed-software list on the QA
machine, so it asks only for what is genuinely missing.

> **The critical item is not a software install — it is item C1, application
> allowlisting.** The machine runs Airlock Digital application control. Without an
> allowlist rule, the tooling can install successfully and still be unable to run.
> Please read C1 before scheduling any install work.

---

## Section A — Already present (no action needed)

Confirmed from the installed apps list, recorded so nothing is requested twice.

| Software                    | Version        | Relevance                                                                                                   |
| --------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| **Git**                     | 2.55.0.3       | Source control — already installed                                                                          |
| **BrowserStackLocal**       | 3.7.6          | BrowserStack device testing — already installed and evidently in use                                        |
| **SAP GUI for Windows**     | 8.00 (Patch 6) | SAP access already established here (see D3 — we need the _browser-based_ Webgui, a different access route) |
| **Java SE Development Kit** | 17.0.16        | Runs the existing Selenium suite this project replaces                                                      |
| **Chrome / Edge / Firefox** | current        | Browsers the tests will drive                                                                               |
| **Postman**                 | 12.23.5        | API testing                                                                                                 |
| **Mockoon**                 | 9.7.0          | API mocking                                                                                                 |
| **Windows Terminal**        | current        | Command line                                                                                                |
| **Notepad++ / Brackets**    | —              | Text editors (see note under B2)                                                                            |

---

## Section B — Software to install

Only two items. Both are free, open source, and in mainstream commercial use.

| #   | Software               | Version                      | Why it is needed                                                                                                                                                                     | Source                                |
| --- | ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| B1  | **Node.js** (LTS)      | 22 LTS or newer (minimum 20) | The runtime the test framework executes on. Confirmed **not** currently installed. Nothing runs without it. Includes `npm`, the package manager.                                     | https://nodejs.org — official LTS MSI |
| B2  | **Visual Studio Code** | Latest stable                | Confirmed **not** currently installed. Needed specifically for the official Playwright extension (`ms-playwright.playwright`) — the visual test runner, debugger and locator picker. | https://code.visualstudio.com         |

**On B2, pre-empting a fair question:** the machine already has Notepad++ and
Brackets, so "you already have an editor" is a reasonable challenge. The request is
not for an editor as such — it is for the Playwright extension, which exists only
for VS Code and provides the visual debugging needed to maintain these tests.
Brackets was discontinued by Adobe in 2021 and has no equivalent. If VS Code cannot
be approved we can still work from the command line, but diagnosing a failing test
becomes materially slower.

Also requested with B2: the extension `dbaeumer.vscode-eslint`, from the official
Microsoft marketplace.

**Disk space:** approximately 3 GB (~500 MB dependencies, ~1.5-2 GB test browsers).

**Delivery:** the machine is Intune-managed, so deployment via Company Portal is
presumably the normal route.

---

## Section C — Security tooling configuration

_This section determines whether the install actually works._

### C1 — Airlock Digital application allowlisting (CRITICAL)

The machine runs **Airlock Digital Client 7.0.0.0** (application control /
allowlisting), which blocks unapproved executables from running.

Playwright works by downloading and running its own browser binaries. Those are
**executables in a user-profile directory** — precisely what application
allowlisting is designed to stop. The following need to be able to run:

- `node.exe` (from the Node.js install — likely covered once it is in Program
  Files, but worth confirming)
- The test browser binaries, by default under
  `%USERPROFILE%\AppData\Local\ms-playwright\` — including `chrome.exe`,
  `headless_shell.exe`, `firefox.exe` and a WebKit executable
- Small native helper binaries inside the project's `node_modules` folder

**Without an allowlist rule, tests will fail to launch a browser even though
everything appears correctly installed.** This is the most likely cause of a failed
setup on this machine.

**Suggested approaches — we would welcome IT's preference:**

- **Option 1 (preferred, most secure).** We configure Playwright to install its
  browsers to a fixed machine-level directory instead of the user profile — for
  example `C:\Playwright\browsers` — using the `PLAYWRIGHT_BROWSERS_PATH`
  environment variable. IT then allowlists that single controlled location. This
  avoids allowlisting anything inside a user-writable profile directory.
- **Option 2.** Publisher-based allowlisting — the Playwright browser builds are
  signed by Microsoft.
- **Option 3.** A path rule covering `%LOCALAPPDATA%\ms-playwright\`. Simplest, but
  we recognise that permitting execution from a user-writable path is weaker, so we
  would rather do Option 1 if IT is willing.

We are happy to work to whatever fits the Airlock policy — we just need the
approach agreed before we start, rather than discovering the block mid-setup.

### C2 — TLS inspection certificate (CONFIRMED ISSUE)

The machine has the **Cisco Secure Access Root Certificate** installed, which
confirms HTTPS traffic is inspected.

Node.js does **not** use the Windows certificate store — it maintains its own trust
list. So out of the box, `npm` and the Playwright browser download **will fail with
certificate errors** on this machine. Given the Cisco root certificate is present,
this is expected rather than merely possible.

**The fix**, either of:

- Set a machine-level environment variable `NODE_EXTRA_CA_CERTS` pointing to an
  exported copy of the Cisco Secure Access root certificate in PEM format (for
  example `C:\ProgramData\certs\cisco-root.pem`); **or**
- Add the addresses in C3 to the TLS inspection bypass list.

The first is generally preferable as it keeps inspection in place. We would need IT
to export the certificate and set the variable, as both are machine-level.

### C3 — Network / DNS access

The machine runs **Cisco Umbrella** (DNS filtering) alongside AnyConnect VPN.
Please confirm the following are permitted, both on and off VPN:

- `registry.npmjs.org` — the package registry
- `cdn.playwright.dev` (and `playwright.azureedge.net`) — browser downloads
- `github.com`, `codeload.github.com`, `objects.githubusercontent.com` — source code

### C4 — Endpoint protection / monitoring exclusions

The machine also runs **ManageEngine UEMS Agent** and **ITM SaaS (IT Client
Utility)**. Once the tooling works, we may need scanning exclusions for the
`node_modules` and browser directories — a Node project holds tens of thousands of
small files, and real-time scanning slows test runs considerably.

**Not blocking.** We would rather get the install working first and return with a
specific, evidenced request if performance proves to be a problem.

---

## Section D — Access and accounts

| #   | Access                       | Detail                                                                                                                                                                                                                                                                                                                                                          | Priority |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D1  | **GitHub repository access** | Write access for the three testers, plus permission to create a new repository for this project.                                                                                                                                                                                                                                                                | Now      |
| D2  | **BrowserStack credentials** | The BrowserStackLocal client is already installed, so an account almost certainly exists. We need the username and access key for automated runs — ideally a service credential rather than a personal one.                                                                                                                                                     | Phase 2  |
| D3  | **SAP QA Webgui access**     | The machine has SAP GUI **for Windows** (desktop client). Our automation drives **SAP GUI for HTML (Webgui)** — the browser-based interface to the same system. We need (a) confirmation Webgui is enabled on the QA system and its URL, and (b) a dedicated SAP QA user. Please also confirm whether that account is shared, and its concurrent session limit. | Phase 3  |
| D4  | **GitHub Actions**           | Confirm it is enabled for the organisation, for scheduled overnight runs.                                                                                                                                                                                                                                                                                       | Phase 2  |

---

## What we can do ourselves

No IT involvement needed for any of this, once the above is in place:

- Downloading the test browsers (`npx playwright install`)
- Installing project dependencies (`npm ci`)
- Creating and editing local configuration
- Writing, running and debugging tests

---

## Suggested phasing

**Phase 1 — unblocks all local test development (the priority)**
B1, B2, **C1**, **C2**, C3, D1

**Phase 2 — cross-browser coverage and overnight runs**
D2, D4

**Phase 3 — SAP back-office automation**
D3

C1 and C2 are emphasised because they are the two items that will cause the setup
to fail if missed.

---

## Security notes (for the approval reviewer)

- Node.js and VS Code are mainstream, actively maintained open-source projects in
  very widespread commercial use. VS Code is published by Microsoft.
- We are **not** asking to disable or bypass Airlock, TLS inspection, or endpoint
  protection. C1 asks for a scoped allowlist rule, and we have proposed the most
  restrictive option available. C2 asks for the corporate certificate to be made
  available to Node, which keeps inspection working rather than turning it off.
- No credentials are stored in source code. All URLs, usernames and passwords come
  from a local configuration file explicitly excluded from source control, and from
  GitHub's encrypted secrets store for automated runs.
- The framework contains a deliberate safety mechanism that **refuses to run**
  against any production storefront or production SAP system, and fails closed: if
  it cannot positively confirm a target is a test environment, it will not run.
- No real card data is used. Payment testing uses the payment provider's published
  test card values, supplied via configuration.
