# Architecture Decision Records (ADRs)

## ADR-001: Native Setter Bypass for Form Filling
Status: Accepted
Context: Standard `input.value = "test"` assignment does not trigger Google Forms' React/Angular event bindings, leaving the form effectively unfilled.
Decision: Use native setter bypass (`Object.getOwnPropertyDescriptor(...).set.call`) and dispatch synthetic events (`focus`, `input`, `change`, `blur`) via `dispatchInputEvents()`.
Consequences: Requires maintaining complex synthetic event dispatching code, but guarantees the form recognizes the filled data.

## ADR-002: Fuzzy Matching for Labels
Status: Accepted
Context: Form question texts and radio/dropdown labels often contain slight variations, hidden characters, or case differences.
Decision: Rely on `fuzzyMatch()` and `normalizeQuestion()` for string comparisons between AI mappings, learned mappings, and dropdown/radio options. Do not use strict `===`.
Consequences: Improves match rate significantly, though occasionally might produce false positives if thresholds aren't tuned correctly.

## ADR-003: Side Panel UI over Traditional Popup
Status: Accepted
Context: The user needs a persistent UI while interacting with and filling out forms, which a traditional popup does not provide since it closes on click-away.
Decision: Configure the UI to run as a Chrome Side Panel.
Consequences: Requires specific manifest permissions (`sidePanel`) and background worker configuration, but offers a significantly better user experience.

## ADR-004: Strict Privacy Boundary for AI
Status: Accepted
Context: The extension uses the Gemini API for form classification, which could accidentally expose sensitive user data.
Decision: Only question labels, field keys, or explicitly selected text for import are sent to the Gemini API. Existing Knowledge Base user data (values) is never sent to the API.
Consequences: Ensures absolute user privacy but limits the AI from using actual data context to improve its field mapping confidence.
