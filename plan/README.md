# Croatia charter enquiries

Plain HTML, CSS and JavaScript landing page at `/sailorspot-showcase/plan/`.
It uses system fonts and an original decorative SVG chart. No third-party JavaScript or image service is loaded.

## API configuration

`index.html` contains `<meta name="enquiry-api" content="https://api.sailorspot.ch/v1/enquiries">`.
Change this value for another HTTPS deployment, or a localhost HTTP endpoint for acceptance tests. The visit endpoint is `/v1/visits` on the same origin as this API URL. The API must allow CORS requests from the page origin.

The enquiry request is JSON with `requestId` (UUID v4), `email`, optional `name`, `destination: "Croatia"`, `dateMode`, either `startDate` or `month`, numeric `durationWeeks` and `guests`, `skipper`, `budget`, `notes`, `source`, `consent: true` and the `website` honeypot. The backend is responsible for final validation and spam handling. A successful 200 or 201 response must include a nonempty string `reference` and parseable `receivedAt` date. No other response is shown as a success.

The rough budget is **EUR per yacht per week**, with possible extras. Skipper choices are `self`, `needed`, `unsure`; budget choices are `under-3000`, `3000-5000`, `5000-8000`, `8000-plus`, `unsure`.

## Privacy and retries

The form sends only a validated `utm_source` slug or `direct`, never the full page URL or referrer. Fetch requests omit credentials and use `no-referrer`. The visit request is `{visitId, source}` and is attempted once per tab session, independently of the enquiry form.

`sessionStorage` retains only the anonymous visit identifier/source and the current enquiry's request UUID plus SHA-256 payload hash. Form contact details are not stored in browser storage. A retry with unchanged details reuses the UUID, including after a timeout. Changed details create a new UUID. The form remains populated on errors, and only a valid server receipt replaces it with a success panel. A server 409 clears the conflicting key and asks the visitor to submit again; it does not automatically create another enquiry.

`form-model.mjs` exports pure serialization, date, source and validation helpers for acceptance checks. No build step is required.
