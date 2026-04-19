# Security & Privacy

## Threat Model & Findings
- **API Key Storage [HIGH SEVERITY]**: The Gemini API key is currently stored in plaintext in `chrome.storage.local`.
- **Knowledge Base Storage [MEDIUM SEVERITY]**: User personal data is stored in plaintext. If users store sensitive data (SSN, credit cards), this poses a risk.
- **Host Permissions**: The extension requires broad host permissions (`https://docs.google.com/forms/*` and `https://generativelanguage.googleapis.com/*`). The Google Forms scope is necessary to ensure reliable injection from the Side Panel context.

## Privacy Guarantee
Only question labels, field keys, or explicitly selected text for import are sent to the Gemini API. Existing Knowledge Base user data (values) is **never** sent to the API during form classification.

## Future Mitigations
- Implement lightweight AES encryption for data stored in `chrome.storage.local`.
