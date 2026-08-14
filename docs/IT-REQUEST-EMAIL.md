# Draft email to IT

Copy the text below the line into Outlook. Square-bracketed parts need filling in
before you send.

---

**Subject:** Software request — test automation tooling (Node.js + VS Code, plus Airlock allowlisting)

Hi [name],

I'd like to request a couple of things to be installed on my machine, and I wanted
to explain what it's for and flag one item up front that I think will need some
thought from your side.

**What this is for**

We currently run our ecommerce regression testing manually across the three UK
websites — Goldsmiths, Mappin & Webb, and Watches of Switzerland. As the three
sites run on the same platform, every change has to be checked three times by
hand, which is slow and easy to get wrong.

We already have some automated testing using Java and Selenium — the Java tooling
is already installed and approved on my machine. What I'm doing now is rebuilding
that properly using **Playwright**, which is the current industry-standard tool for
this and is much better suited to how our storefronts are built. The framework is
already written and working; I just need the tooling installed locally to run it.

The result is a suite that checks all three sites automatically, including
overnight, rather than consuming several days of manual testing per release.

**What I need installed**

I've checked my installed software list first, so this is only what's genuinely
missing — Git and the BrowserStack client are already there.

1. **Node.js** (LTS, version 22 or newer) — free and open source, from
   https://nodejs.org. This is the runtime the tests run on.

2. **Visual Studio Code** — free, from Microsoft (https://code.visualstudio.com),
   plus two extensions from the official Microsoft marketplace:
   `ms-playwright.playwright` and `dbaeumer.vscode-eslint`.

   I know I already have Notepad++ and Brackets, so this may look like a duplicate
   request. The reason it isn't is that the ask is really for the Playwright
   extension, which only exists for VS Code — it's what lets me watch a test run
   step by step and see why it failed. Brackets was discontinued by Adobe in 2021.

Disk space needed is roughly 3GB.

**The one thing I'd like your input on before we start**

My machine runs **Airlock Digital**, and I think this is likely to block things
even after the install is done — so it's worth sorting out up front rather than
finding out halfway through.

Playwright works by downloading its own copies of the test browsers and running
them. By default those land in my user profile folder, and they're executables, so
I'd expect Airlock to stop them running. If that happens, everything will look
correctly installed but no test will actually launch a browser.

Rather than just asking for a blanket exception, there's a tidier option: I can
configure Playwright to install those browsers into a fixed folder you control —
say `C:\Playwright\browsers` — instead of my user profile, and you allowlist that
one location. That avoids allowing executables to run from a user-writable folder.
Happy to do it whichever way suits your policy, I just don't want to discover the
block mid-setup.

**One related thing — certificates**

I can see the Cisco Secure Access root certificate on my machine, so I assume
we're inspecting HTTPS traffic. Node.js doesn't use the Windows certificate store,
it keeps its own, so its downloads will almost certainly fail with certificate
errors out of the box. The usual fix is to set a system environment variable
`NODE_EXTRA_CA_CERTS` pointing at an exported copy of that Cisco root certificate.
Flagging it now as it's a very common stumbling block and would otherwise look
like the software is simply broken.

I'd also just need to check these addresses aren't blocked by Umbrella:
`registry.npmjs.org`, `cdn.playwright.dev` and `github.com`.

**Access**

- Write access to our GitHub repository for me and the other two testers, and
  permission to create a new repository for this project.
- Further down the line I'll need the BrowserStack account credentials (the
  BrowserStackLocal client is already installed on my machine, so I assume we have
  an account) and a SAP QA user for the back-office side — but neither of those
  blocks me getting started.

**On security**

Both tools are free, open source and very widely used commercially; VS Code is
Microsoft's own. To be clear, I'm not asking to disable Airlock, turn off HTTPS
inspection, or switch off any endpoint protection — just for a scoped allowlist
rule and for our own certificate to be made available to Node.

No passwords or card details are stored in the code — they're kept in a local
configuration file that's deliberately excluded from source control. The framework
also has a built-in safeguard that refuses to run against any live website or live
SAP system, so there's no risk of test activity touching production.

Happy to talk any of this through, or to write it up more formally if it needs to
go through an approval process.

Thanks,
Dale

---

## Notes before you send

**What I confirmed from your screenshots:**

- **Git 2.55.0.3** — installed, removed from the ask
- **BrowserStackLocal 3.7.6** — installed, so BrowserStack access likely already
  exists; softened that to "just need the credentials"
- **Node.js** — confirmed **not** installed (the list runs News → Notepad, no Node)
- **VS Code** — confirmed **not** installed (runs Microsoft Visual C++ → Visual
  Studio 2010 Tools, no VS Code)

**Why Airlock leads the email.** Airlock Digital is application allowlisting. It
is, in my view, more likely to break this setup than anything else on the list,
and it is invisible until the moment a test tries to launch a browser. Raising it
now costs one paragraph; discovering it later costs another ticket and a week.

**The certificate point is not hypothetical.** The Cisco Secure Access root
certificate on the machine means HTTPS is being inspected. Node.js ignores the
Windows certificate store, so this will bite.

**If the email feels long,** the two sections that could be cut are "On security"
and the access bullets — but I'd keep Airlock and certificates in whatever
happens, as those are the two that determine whether it works at all.
