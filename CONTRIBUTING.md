# Contributing to Watch Better

Bug fixes, provider compatibility updates, accessibility improvements, and focused
documentation changes are welcome.

## Setup

Use Node.js 22 or newer and npm 10 or newer.

```bash
npm ci
npm run dev:harness
```

Load `.output/chrome-mv3/` from `chrome://extensions` after running `npm run build`
when testing the real extension.

## Before opening a pull request

```bash
npm run validate
```

Keep changes focused. Include tests for behavior changes and describe any live
Chrome checks performed. Never include cookies, tokens, private transcripts, or
account data in fixtures, screenshots, logs, issues, or commits.

Use the bug report form for reproducible defects. Report security vulnerabilities
through [GitHub private vulnerability reporting](https://github.com/wasely/watch-better/security/advisories/new),
not a public issue.
