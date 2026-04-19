# Architecture

## Module Map

- **`knowledge.js` (The Knowledge Base & Learning Engine)**
  - Manages the user's personal data (`knowledgeBase`) and the mapping of form questions to data fields (`fieldMappings`).
  - Organizes data into categories (`identity`, `contact`, `address`, `education`, `work`, `personal`, `custom`). Example mapping: `contact.email`.
  - Includes a Learning Engine (`learnFromFill()`) that normalizes question text (e.g., "Họ và tên" -> "họ và tên") and stores the mapping.
  - Auto-creates `custom` fields based on AI suggestions if the user provides a value, saving it in `kb.custom`.

- **`ai.js` (AI Integration)**
  - Communicates with the `gemini-2.5-flash` API.

- **`content.js` (Content Script)**
  - Injected into `https://docs.google.com/forms/*` to read and manipulate the DOM.
  - **Scanning (`scanForm`)**: Looks for elements with `[data-params]` or `[jsmodel]`. Extracts the question label and detects the field type (Text, Radio, Checkbox, Dropdown, Date, etc.).
  - **Filling (`fillForm`)**: Uses native setters and synthetic events. For radios/checkboxes, it uses fuzzy matching against the labels and triggers simulated mouse clicks.

- **`popup.js`, `popup.css`, `popup.html`, `sidepanel.html` (UI)**
  - The main user interface, configured to run as a Chrome Side Panel but functions identical to a popup.
  - Tabs: `Smart Fill` (AI-driven flow showing confidence badges 🟢/🟡/🔴), `My Data` (manage KB, API keys, import unstructured text with Review Modal), `Profiles` (legacy fallback).
  - Uses `chrome.tabs.sendMessage` to communicate with `content.js`, with robust retry logic (up to 3 times) for initialization delays.

- **`background.js` (Background Service Worker)**
  - Initializes default storage on install, configures the Side Panel behavior, and manages Context Menus (e.g., "Import to Knowledge Base").

- **`manifest.json` (Permissions & Config)**
  - Uses `storage`, `contextMenus`, `activeTab`, `scripting`, `sidePanel`, `tabs`, and specific `host_permissions` for Google Forms and Gemini API.

## Data Flow

### Form Classification
1. **Scan**: `content.js` scans the form for unmapped questions.
2. **AI Map**: `ai.js` receives unmapped questions and available `knowledgeBase` fields, then prompts the AI to map them (or invent `custom.xyz` fields). Returns mappings with a `confidence` score (0.0 to 1.0).
3. **Fill**: `content.js` fills the form based on resolved fields (AI or Learned).

### Natural Language Import
1. **Highlight & Send**: Highlighted web text is sent via Context Menu (`background.js`) to `chrome.storage.local`.
2. **AI Extract**: `ai.js` uses `gemini-2.5-flash` to extract structured JSON matching the Knowledge Base schema.
3. **Review & Save**: UI shows a Review Modal overlay for the user to confirm before saving to `knowledgeBase`.

## Key Invariants

- **Native Setter Bypass**: Google Forms use React/Angular event bindings. Standard `input.value = "test"` fails. Always use native setters (`Object.getOwnPropertyDescriptor(...).set.call`) and dispatch synthetic events (`focus`, `input`, `change`, `blur`) via `dispatchInputEvents()`.
- **Fuzzy Matching**: String comparisons between AI mappings, learned mappings, and dropdown/radio options rely on `fuzzyMatch()` and `normalizeQuestion()`. Do not use strict `===` for user-facing text.
- **Privacy Guarantee**: Only question labels, field keys, or explicitly selected text for import are sent to the API. Existing user data (values) in the Knowledge Base is **never** sent to the API during form classification.
