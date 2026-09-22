# SailorSpot project showcase

A public, informational presentation of the SailorSpot mobile prototype and proposed activity. It is not a booking service. Prices, availability and bookings shown in screenshots are demonstration data. Revenue details are intentionally omitted.

**Website:** https://kcybul.github.io/sailorspot-showcase/

## Content

- `index.html`: project overview and actual app screenshots supplied by the project owner.
- `styles.css`: responsive navy/ivory design, accessible focus states and print layout.
- `app.js`: keyboard-accessible screenshot enlargement using a native dialog.
- `assets/`: three original screenshots and the site icon.

No framework, build dependency, backend, account form, analytics or payment integration is required. GitHub Pages serves the static files. The private SailorSpot application repository is separate.

## Preview

```sh
python3 -m http.server 8097 --bind 127.0.0.1
```

Open http://127.0.0.1:8097/. Changes pushed to `main` publish automatically via the Pages workflow. Only `index.html`, `styles.css`, `app.js`, `.nojekyll` and `assets/` are included in the published artifact. No macOS runner is used.

## Review checklist

Check desktop, phone and tablet layouts; open all three screenshots; close with the button and Escape; check restored keyboard focus; verify navigation, contact and FAQ links. Confirm the deployment URL and all assets respond without authentication.

Screenshots and yacht photographs are presented as documentation of the prototype. This repository does not grant a licence to reuse third-party imagery. No commercial supplier partnership or live charter availability is asserted.
