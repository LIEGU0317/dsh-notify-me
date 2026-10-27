# Security policy

[中文](SECURITY.md)

## Reporting a vulnerability

Please do not report security issues through public issues. Use GitHub's private reporting channel:

<https://github.com/chromoany/dsh-notify-me/security/advisories/new>

Include the plugin version, the DSH version and runtime (web or desktop), reproduction steps, and the impact the issue allows. Remove external push URLs, access tokens, session titles, and message text before attaching logs or `debug()` output.

## Version scope

Only the latest published release (currently 1.14.x) is accepted. For older builds, upgrade and retest first. Issues in the host or the Electron shell belong to the upstream project.

## Data the plugin handles

- Alerts contain the session label, the first 160 characters of a pending approval or question, and the first 80 characters of a reply. By default they are presented locally only: OS notification, sound, tab title.
- When external push is enabled, that text is sent to endpoints the user configured; URLs and secrets are stored in browser local storage. The plugin runs no backend service, collects no usage data, and forwards nothing to other third parties.
- When a desktop notification is clicked, on Windows the host runs PowerShell to raise the window; on macOS / Linux the page fires the `dsh://open` deep link and the host is not involved. The host route accepts a loopback peer and a loopback `Host` only; when an `Origin` is present it must match that `Host`, and a dedicated request header is required.

## In scope

Bypassing the raise-window route, credentials appearing in logs or `debug()` output, insufficient validation of external push URLs, unexpected files in the published npm package.

## Out of scope

Issues that require the user to modify the console or localStorage by hand first, defects in browsers or the notification systems themselves, vulnerabilities in third-party push services.

## Response time

The repository is maintained by a single person. Vulnerability reports usually receive a reply within one week; fixes are recorded in the CHANGELOG.

## Handling credentials

External push URLs and access tokens are credentials. Do not include them in issues, screenshots, or public records.
