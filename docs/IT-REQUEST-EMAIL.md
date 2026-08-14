# Draft email to IT

Copy the text below the line into Outlook. Square-bracketed parts need filling in
or checking before you send.

---

**Subject:** Software request — test automation tooling for QA (Node.js + VS Code)

Hi [name],

I'd like to request some software to be installed on my machine, and I wanted to
explain what it's for so the request makes sense.

**What this is for**

We currently run our ecommerce regression testing manually across the three UK
websites — Goldsmiths, Mappin & Webb, and Watches of Switzerland. Because the
three sites are built on the same platform, every change has to be checked three
times by hand, which is slow and easy to get wrong.

We already have a small amount of automated testing in place using Java and
Selenium (the Java tooling is already installed and approved on my machine). What
I'm doing now is rebuilding that properly using **Playwright**, which is the
current industry-standard tool for this kind of testing and is much better suited
to how our storefronts are built. The framework itself is already written — I just
need the tooling installed locally to run it.

The end result is a test suite that checks all three sites automatically,
including overnight, instead of consuming several days of manual testing per
release.

**What I need installed**

1. **Node.js** (LTS version, 22 or newer) — free and open source, from
   https://nodejs.org. This is the runtime the test framework runs on. Nothing
   works without it.

2. **Visual Studio Code** — free, from Microsoft (https://code.visualstudio.com),
   plus two extensions from the official marketplace: `ms-playwright.playwright`
   and `dbaeumer.vscode-eslint`. This is what lets me watch tests run step by
   step and debug them when they fail.

_[Check first and delete whichever is already installed — Git 2.55.0.3 is already
on my machine so I've left it off the list.]_

Disk space needed is roughly 3GB.

**Network access**

The two items above download their components from the internet on first setup,
so I'll also need outbound HTTPS access to these, if they aren't already
permitted:

- `registry.npmjs.org`
- `cdn.playwright.dev`
- `github.com`

One thing worth flagging in advance: if our network inspects HTTPS traffic
(Zscaler, Netskope or similar), these downloads will fail with certificate
errors. The usual fix is to add those three addresses to the inspection bypass
list. Might be worth checking before we start, as it's the most common reason
this kind of setup stalls.

**Access I'll need**

- Write access to our GitHub repository for me and the other two testers, and
  permission to create a new repository for this project.
- Later on, I'll need our existing BrowserStack account details and a SAP QA user
  account, but neither of those blocks me getting started.

**On security**

All three tools are free, open source, and very widely used commercially. No
passwords or card details are stored in the code — they're kept in a local
configuration file that's deliberately excluded from source control. The
framework also has a built-in safeguard that refuses to run against any live
website or live SAP system, so there's no risk of test activity touching
production.

Happy to talk any of this through, or to provide more detail if it needs to go to
a formal approval.

Thanks,
Dale

---

## Notes before you send

- **Check what's already installed first.** Run `node --version`, `code --version`
  and `git --version` in PowerShell. Git is confirmed installed (2.55.0.3). If
  Node or VS Code turn out to be there too, trim the list accordingly — a shorter
  request approves faster.
- **The Windows settings (antivirus exclusions, long paths, PowerShell policy)
  are deliberately not in this email.** They're only a problem once the install is
  done, and raising them up front makes the request look bigger than it is. The
  full list is in `IT-REQUEST.md` when you need it.
- **The network access section is worth keeping**, even though it feels like a
  detail. If IT installs Node but the proxy blocks the package registry, nothing
  works and you'll be back in the queue.
