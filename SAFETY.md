# Operational Safety

## Error Handling
- **Rate Limiting (429)**: The Gemini API free tier often returns `429 Too Many Requests` due to high demand. `ai.js` catches this, but the UI must gracefully handle it without breaking the user experience.
- **Restricted Tabs Guard**: `chrome.scripting.executeScript` might fail if the tab is a restricted URL. The `checkActiveTab()` function ensures we are on a valid Google Form before allowing a scan.
- **Content Script Initialization**: Message passing between `popup.js` and `content.js` uses retry logic (up to 3 times) to handle cases where the content script is still initializing after injection.

## Do-Not-Touch Rules
- **DOM Selectors**: Do not use strict class names (like `.M7eMe`) or internal Google Form IDs (e.g., `entry.12345`). Use generic structural cues (`[data-params]`, `[role="heading"]`, `[role="radio"]`).
