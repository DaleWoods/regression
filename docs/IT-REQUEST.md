# IT Request — Playwright Test Automation Environment

**Requested by:** QA / Test Automation team (3 users)
**Purpose:** Set up the WOSG UK automated regression suite for the Goldsmiths,
Mappin & Webb and Watches of Switzerland UAT storefronts, plus SAP QA back-office
automation.
**Machines affected:** 3 Windows workstations (the QA testers).

All software listed is free, open source, and industry-standard for test
automation. Nothing runs against production systems — the framework contains a
hard-coded block that refuses to start if it detects a production URL.

---

## Section A — Software to install

_Requires IT installation (admin rights on Program Files)._

| #   | Software               | Version                      | Why it is needed                                                                                                                                                                                | Source                                            |
| --- | ---------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| A1  | **Node.js** (LTS)      | 22 LTS or newer (minimum 20) | The runtime the whole test framework executes on. Includes `npm`, the package manager. Without this nothing runs.                                                                               | https://nodejs.org — official LTS installer (MSI) |
| A2  | **Git for Windows**    | Latest stable                | Source control. The test code lives in GitHub; this is how we get it and submit changes.                                                                                                        | https://git-scm.com/download/win                  |
| A3  | **Visual Studio Code** | Latest stable                | The editor. Not strictly essential, but the official Playwright extension for it provides the visual test runner, step-through debugging and locator picker the team needs to work efficiently. | https://code.visualstudio.com                     |

**Note on A3:** if VS Code is already approved and installed, we only need
permission to add two extensions from the official marketplace:
`ms-playwright.playwright` and `dbaeumer.vscode-eslint`. Extension installation
does not normally require admin rights, but may be blocked by policy.

**Disk space required:** approximately **3 GB** per machine.
Roughly 500 MB of project dependencies, plus 1.5–2 GB of test browsers
(see B1).

---

## Section B — Windows configuration

_These require IT support — they are machine-level settings or policy changes._

| #   | Setting                                        | What is needed                                                                                                                                                     | Why                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Antivirus / endpoint protection exclusions** | Exclude these two folders from real-time scanning:<br>• `%USERPROFILE%\AppData\Local\ms-playwright`<br>• the `node_modules` folder inside the project directory    | Test browsers live in the first folder; the project has tens of thousands of small dependency files in the second. Real-time scanning of these causes severe slowdowns (test runs taking 10× longer), and some AV products quarantine the bundled Chromium browser as a false positive, which breaks the install entirely. |
| B2  | **Long file path support**                     | Enable `LongPathsEnabled` (registry: `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled` = `1`), and set `git config --system core.longpaths true` | Windows has a legacy 260-character path limit. Node.js dependency trees nest deeply and routinely exceed it, causing install failures with confusing errors. This is a standard, well-documented fix for Node development on Windows.                                                                                      |
| B3  | **PowerShell execution policy**                | Allow `RemoteSigned` for the user scope (or confirm it is not locked to `Restricted` by group policy)                                                              | `npm` on Windows runs through a PowerShell script. If the execution policy is `Restricted` machine-wide, every `npm` command fails. If policy permits, we can set this ourselves with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` — we only need IT if it is enforced by GPO.                                    |

---

## Section C — Network and proxy access

_This is the most common cause of setup failure in a corporate environment, so it
is worth confirming explicitly._

| #   | Requirement                                          | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Allow outbound HTTPS to the package registry**     | `registry.npmjs.org`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| C2  | **Allow outbound HTTPS to the browser download CDN** | `cdn.playwright.dev` and `playwright.azureedge.net` — Playwright downloads its test browsers from here on first setup                                                                                                                                                                                                                                                                                                                                 |
| C3  | **Allow outbound HTTPS to GitHub**                   | `github.com`, `codeload.github.com`, `objects.githubusercontent.com`, `api.github.com`                                                                                                                                                                                                                                                                                                                                                                |
| C4  | **SSL/TLS inspection handling**                      | **Important.** If the network uses TLS interception (Zscaler, Netskope, Palo Alto or similar), `npm` and Playwright downloads will fail with certificate errors. We need either: (a) the corporate root CA certificate made available to Node.js via the `NODE_EXTRA_CA_CERTS` environment variable, **or** (b) the domains in C1–C3 added to the TLS inspection bypass list. Option (b) is simpler and is the common approach for developer tooling. |
| C5  | **Access to the UAT storefronts**                    | Confirm the three UAT sites are reachable from the QA workstations — some UAT environments are IP-allowlisted or VPN-only. Sites: Goldsmiths UAT, Mappin & Webb UAT, Watches of Switzerland UAT.                                                                                                                                                                                                                                                      |
| C6  | **Access to the SAP QA Webgui host**                 | Confirm the SAP QA system's web interface is reachable from the QA workstations. _(Only needed for the ERP phase — not blocking for the storefront work.)_                                                                                                                                                                                                                                                                                            |

---

## Section D — Accounts and access

_Not software — but needed before the work can be completed._

| #   | Access                       | Detail                                                                                                                                                                                                                                                                                                        | When needed   |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| D1  | **GitHub repository access** | Write access to the test automation repository for all three testers. We also need permission to **create a new repository** for this project (it is intended to live separately from the existing `regression` repo).                                                                                        | Immediately   |
| D2  | **BrowserStack credentials** | Username and access key for the existing company BrowserStack Automate subscription. Used for testing on real iOS/Android devices.                                                                                                                                                                            | Phase 2       |
| D3  | **SAP QA user account**      | A dedicated SAP QA user with Webgui (SAP GUI for HTML) access and permission to run the relevant transactions. **Please confirm whether this account is shared with anyone else, and its concurrent session limit** — the automation is designed around this. Ideally a dedicated account not used by humans. | Phase 3 (ERP) |
| D4  | **GitHub Actions**           | Confirm GitHub Actions is enabled for the organisation, so tests can run automatically overnight.                                                                                                                                                                                                             | Phase 2       |

---

## What we can do ourselves once the above is in place

For clarity, no further IT involvement is needed for any of the following — these
are all user-level actions within the installed tools:

- Downloading the test browsers (`npx playwright install` — writes to the user
  profile, no admin rights required, provided C2 and C4 are satisfied)
- Installing project dependencies (`npm ci` — writes into the project folder)
- Creating and editing the local configuration file (`.env`)
- Writing, running and debugging tests
- Configuring VS Code settings

---

## Suggested phasing

If it helps to split the approval, the request breaks down cleanly:

**Phase 1 — unblocks all local test development (the priority)**
A1, A2, A3, B1, B2, B3, C1–C5, D1

**Phase 2 — cross-browser/device coverage and overnight runs**
D2, D4

**Phase 3 — SAP back-office automation**
C6, D3

Phase 1 alone lets the team build and run the storefront regression suite.

---

## Alternative if desktop installation is not approved

If installing development tooling on the workstations is not possible, the same
work can be done in a **cloud development environment** (GitHub Codespaces, or an
equivalent hosted VM) accessed through the browser. This removes the need for
Sections A and B entirely, but introduces a subscription cost and still requires
Section C5/C6 network access from the hosted environment to the UAT systems.
Worth raising only if the desktop route is blocked.

---

## Security notes (for the approval reviewer)

- All three tools (Node.js, Git, VS Code) are mainstream, actively maintained
  open-source projects in widespread commercial use.
- No credentials are stored in the source code. All URLs, usernames and passwords
  are supplied through a local configuration file that is explicitly excluded from
  source control, and through GitHub's encrypted secrets store for automated runs.
- The framework includes a deliberate safety mechanism that **refuses to run**
  against any production storefront or production SAP system, and fails closed —
  if it cannot positively confirm a target is a test environment, it will not run.
- No card data is stored. Payment testing uses the payment provider's published
  test card values, supplied via configuration.
