# SailorSpot project showcase

A public, informational presentation of the SailorSpot mobile prototype and proposed activity. It is not a booking service. Prices, availability and bookings shown in screenshots are demonstration data. Revenue details are intentionally omitted.

**Live website:** https://sailorspot.pearly-pine-6119.chatgpt.site/

**Charter enquiries:** https://sailorspot.pearly-pine-6119.chatgpt.site/plan/

This repository remains the public source. The live website is published through
OpenAI Sites independently of GitHub Actions. GitHub Pages remains an optional
mirror; its `/plan/` deployment has not completed. Managed deployment copies only
public files and adjusts canonical URLs and the hosting-provider privacy notice.

## Content

- `index.html`: project overview and actual app screenshots supplied by the project owner.
- `styles.css`: responsive navy/ivory design, accessible focus states and print layout.
- `app.js`: keyboard-accessible screenshot enlargement using a native dialog.
- `assets/`: three original screenshots and the site icon.
- `plan/`: a Croatia charter-planning enquiry page, with its own privacy notice.

The original project overview has no forms or analytics. The separate [charter-planning pilot](https://sailorspot.pearly-pine-6119.chatgpt.site/plan/) submits enquiries and anonymous session visit counts to `https://api.sailorspot.ch`. It does not confirm live prices, availability or bookings, and takes no payment. Contact details are not saved in browser storage. The private SailorSpot repository contains the durable enquiry service and its operating runbook.

Both pages are static HTML, CSS and JavaScript, without a production framework or third-party scripts. Node dependencies are used only for browser acceptance tests.

## Preview

```sh
python3 -m http.server 8097 --bind 127.0.0.1
```

Open http://127.0.0.1:8097/. Changes pushed to `main` publish automatically after the Pages workflow passes the enquiry browser checks. Only the public root files, `assets/`, and the page files in `plan/` are published. Tests and dependencies are excluded. No macOS runner is used.

## Enquiry acceptance checks

```sh
npm ci
npx playwright install chromium
npm run test:enquiry
```

These checks exercise desktop and a phone-sized Chromium viewport: validation, receipt handling, duplicate prevention, timeouts, preserved form fields, error recovery and visit counting. They are not a claim of Safari or native iPhone verification. To test an isolated real enquiry service with a disposable database and SMTP inbox:

```sh
ENQUIRY_LIVE_API_BASE=http://127.0.0.1:8200 npm run test:enquiry:live
```

The test API must allow `http://127.0.0.1:8097` as a CORS origin. Do not point this test at a real customer or mailbox. Owner email delivery also needs configured SMTP credentials and separate inbox verification; successful form storage alone does not establish email delivery.

## Review checklist

Check desktop, phone and tablet layouts; open all three screenshots; close with the button and Escape; check restored keyboard focus; verify navigation, contact and FAQ links. Confirm the deployment URL and all assets respond without authentication.

Screenshots and yacht photographs are presented as documentation of the prototype. This repository does not grant a licence to reuse third-party imagery. No commercial supplier partnership or live charter availability is asserted.
