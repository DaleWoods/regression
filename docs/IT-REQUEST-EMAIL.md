# Draft email to IT

Copy the text below the line into Outlook.

---

**Subject:** Software install request — Node.js and Visual Studio Code (test automation)

Hi [name],

Could I please request the following two pieces of software to be installed on my
machine:

1. **Node.js** — LTS version 22 or newer. Free and open source, from
   https://nodejs.org (official MSI installer).

2. **Visual Studio Code** — latest version. Free, from Microsoft,
   https://code.visualstudio.com. Along with two extensions from the official
   Microsoft marketplace: `ms-playwright.playwright` and `dbaeumer.vscode-eslint`.

**Background — this is a continuation, not a new start**

I've already built a working automated test suite for our UK websites using
Selenium with Java, which runs a full customer journey from browsing through to
checkout and order confirmation. That work is done and it functions.

What I'm doing now is moving that suite over to **Playwright with TypeScript**.
This isn't starting again — the hard part of test automation is working out how to
reliably identify and drive the elements on our pages, and all of that knowledge
carries directly across. The new framework reuses the page definitions and element
locators proven by the Selenium work; what changes is the tool underneath.

**Why move**

- **Reliability.** Our storefronts are single-page applications, where content
  loads dynamically. Selenium needs code written by hand to wait for each element,
  and a large portion of the existing suite is exactly that — waits, retries and
  workarounds. Playwright handles this automatically, which removes the main cause
  of tests failing intermittently for no real reason.
- **Three sites, one test.** Goldsmiths, Mappin & Webb and Watches of Switzerland
  all run on the same platform. Playwright lets a test be written once and run
  against all three from configuration. That's the single biggest saving available
  to us, and it is far more work to achieve in Selenium.
- **Visibility.** Playwright records a replayable trace of any failed test, so we
  can see exactly what happened rather than guessing from a screenshot. With three
  of us maintaining the suite, that matters.
- **Direction of travel.** Playwright is now the standard tool for this kind of
  testing, with better documentation and support than Selenium, and it covers
  Chrome, Firefox and Safari plus mobile from one codebase.

The new framework is already written. I just need the tooling installed locally to
run it.

Both items are free, open source and very widely used commercially. Roughly 3GB of
disk space in total.

Happy to provide more detail if it's needed for approval.

Thanks,
Dale
