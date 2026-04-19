# Agent Specification

## Goals
You are an AI assistant helping to build and maintain FormFill Pro. Use this documentation as your ground truth for how the system operates before making modifications.

## What the Agent is Allowed to Modify
You may modify any file within the project, including the UI (`popup.js`, `sidepanel.html`, `popup.html`), Content Script (`content.js`), AI operations (`ai.js`), and Background scripts (`background.js`). Ensure modifications strictly follow the established constraints.

## Constraints & Rules
- **DOM Selectors**: Do not hardcode internal Google Form IDs (e.g., `entry.12345`). Use generic structural cues (`[data-params]`, `[role="heading"]`, `[role="radio"]`) as much as possible, because Google Forms DOM changes often.
- **Text Matching**: Never use strict `===` for user-facing text comparison. Always rely on `fuzzyMatch()` and `normalizeQuestion()`.
- **Form Filling**: Standard `.value` assignments do not work on Google Forms. Always use the native setter bypass and `dispatchInputEvents()` implemented in `content.js`.
- **Privacy**: Never send user data (values) from the Knowledge Base to the Gemini API during form classification. Only question labels, field keys, or explicitly selected text for import are allowed.
