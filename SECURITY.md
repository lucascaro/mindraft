# Security Policy

## Supported Versions

Mindraft does not use versioned releases. Security fixes are applied to the current production deployment only.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use GitHub's private disclosure process:

1. Go to the [Security Advisories](../../security/advisories) tab of this repository.
2. Click **Report a vulnerability**.
3. Fill in the details — affected area, steps to reproduce, potential impact.

We will acknowledge your report within **2 business days** and aim to release a fix within **14 days** for critical issues. We will keep you informed of progress and credit you in the advisory unless you prefer to remain anonymous.

## Out of Scope

The following are generally not considered vulnerabilities for this project:

- Self-XSS (requires the attacker to run code in their own browser)
- Social engineering attacks
- Volumetric denial-of-service
- Security issues in third-party infrastructure (Firebase, Google Sign-In, Vercel) — report those directly to the respective vendors
- Findings from automated scanners with no demonstrated impact
