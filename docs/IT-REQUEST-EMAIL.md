# Draft email to IT

Copy the text below the line into Outlook.

---

**Subject:** Software install request — Node.js and Visual Studio Code

Hi [name],

Could I please request the following two pieces of software to be installed on my
machine:

1. **Node.js** — LTS version 22 or newer. Free and open source, from
   https://nodejs.org (official MSI installer).

2. **Visual Studio Code** — latest version. Free, from Microsoft,
   https://code.visualstudio.com. Along with two extensions from the official
   Microsoft marketplace: `ms-playwright.playwright` and `dbaeumer.vscode-eslint`.

**What it's for**

I'm building an automated test suite for our three UK websites (Goldsmiths, Mappin
& Webb and Watches of Switzerland). At the moment that regression testing is done
manually, and because all three sites run on the same platform, every change has
to be checked three times by hand.

We already do some of this with Java and Selenium — that tooling is already
installed and approved on my machine. This project rebuilds it using Playwright,
which is the current standard tool for the job and better suited to how our sites
are built. Node.js is the runtime it needs to run on, and the Playwright extension
for VS Code is what lets me step through a test visually when it fails.

Both are free, open source, and very widely used commercially.

Roughly 3GB of disk space needed in total.

Happy to provide more detail if it's needed for approval.

Thanks,
Dale
