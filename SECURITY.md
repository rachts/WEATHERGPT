# Security Policy

## Supported Versions

WeatherGPT is actively maintained for the Smart India Hackathon (SIH 2026) and ongoing institutional deployments with MoES / IMD.

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| 1.0.x   | :white_check_mark: | Active |
| < 1.0.0 | :x:                | Deprecated / Pre-release |

## Reporting a Vulnerability

The WeatherGPT team takes the security and integrity of meteorological data and life-critical emergency advisories very seriously. 

If you discover a security vulnerability (such as prompt injection vectors, authentication bypasses, PII leakage, or rate-limiting vulnerabilities):

1. **Do not create a public GitHub issue.**
2. Please email a detailed advisory to the security team at **`security@weathergpt.gov.in`** or contact the maintainers directly.
3. Include the following details:
   - Type of vulnerability (e.g., SSRF, XSS, Prompt Injection, PII Exposure)
   - Step-by-step reproduction instructions or proof-of-concept
   - Impact assessment on rural users or institutional data feeds
   - Suggested remediation (if known)

### Response Commitments
- **Initial Acknowledgement:** Within 24 hours
- **Severity Triage & Verification:** Within 48 hours
- **Patch Deployment & Public Disclosure:** Coordinated timeline within 7 days

## Security & Integrity Guarantees in WeatherGPT
- **Zero-Fabrication Architecture:** LLMs are strictly quarantined from modifying or generating meteorological telemetry and warnings.
- **Strict PII Protection:** All phone numbers in SMS/IVR routes are masked (`+91******3210`) prior to logging.
- **CG-NAT Session Keying:** Rate limiting uses compound `sessionId + clientIP` hashing to prevent shared rural tower lockouts.
- **Hermetic Ingestion Authorization:** Webhooks and ingestion endpoints enforce HMAC-SHA256 signature verification.
