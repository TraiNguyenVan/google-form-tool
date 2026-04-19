# FormFill Pro — System Architecture & LLM Instructions

**Project Context:** 
This is a Chrome Extension (Manifest V3) designed to intelligently auto-fill Google Forms. It evolved from a static, profile-based auto-filler into an AI-powered smart assistant using the Gemini API and a local Learning Engine.

If you are an LLM reading this file, use this as your ground truth for how the system operates before making modifications.

---

## 🏗 Core Architecture

The extension is split into distinct modules to separate UI, data management, AI operations, and DOM manipulation.

### 1. The Knowledge Base & Learning Engine (`knowledge.js`)
- **Purpose**: Manages the user's personal data (`knowledgeBase`) and the mapping of form questions to data fields (`fieldMappings`).
- **Data Structure**: Data is organized into categories (`identity`, `contact`, `address`, `education`, `work`, `personal`, `custom`). Example mapping: `contact.email`.
- **Learning Engine**: When a user fills a form using "Smart Fill", `learnFromFill()` is called. It normalizes the question text (e.g., "Họ và tên" -> "họ và tên") and stores the mapping. 
- **Auto-creation**: If the AI suggests a new `custom` mapping and the user provides a value, `learnFromFill()` automatically creates that key in `kb.custom` and saves the value.

### 2. AI Integration (`ai.js`)
- **Purpose**: Communicates with the `gemini-2.5-flash` API.
- **Workflow**: 
  1. Receives an array of unmapped questions from the form.
  2. Receives an array of available fields from the user's Knowledge Base.
  3. Prompts the AI to map the questions to the available fields (or invent `custom.xyz` fields if no match exists).
  4. Returns mappings with a `confidence` score (0.0 to 1.0).
- **Privacy**: Only question labels and field keys are sent to the API. User data (values) is **never** sent.

### 3. Content Script (`content.js`)
- **Purpose**: Injected into `https://docs.google.com/forms/*` to read and manipulate the DOM.
- **Scanning (`scanForm`)**: Looks for elements with `[data-params]` or `[jsmodel]`. Extracts the question label and detects the field type (Text, Radio, Checkbox, Dropdown, Date, etc.).
- **Filling (`fillForm`)**: Uses native setters (`Object.getOwnPropertyDescriptor(...).set.call`) and synthetic events (`focus`, `input`, `change`, `blur`) to bypass Google Form's React/Angular event bindings. For radios/checkboxes, it uses fuzzy matching against the labels and triggers simulated mouse clicks.

### 4. Popup / Side Panel (`popup.js`, `popup.css`, `sidepanel.html`)
- **Purpose**: The main user interface. It is configured to run as a **Chrome Side Panel** but functions identical to a popup.
- **Tabs**:
  - `Smart Fill`: The AI-driven flow. Scans the form, resolves fields (AI or Learned), shows confidence badges (🟢/🟡/🔴), and fills the form.
  - `My Data`: Where the user edits their Knowledge Base, adds custom fields, sets the Gemini API key, and views learning stats.
  - `Profiles`: Legacy manual profile system (retained for fallback).
- **Message Passing**: Uses `chrome.tabs.sendMessage` to talk to `content.js`. It includes robust **retry logic** (up to 3 times) to handle cases where the content script is still initializing after injection.

### 5. Background Service Worker (`background.js`)
- **Purpose**: Initializes default storage on install and configures the Side Panel behavior to open when the extension icon is clicked.

### 6. Permissions (`manifest.json`)
- `storage`: For `chrome.storage.local`.
- `activeTab`: To access the current tab.
- `scripting`: To inject `content.js`.
- `sidePanel`: To render the UI in the browser sidebar.
- `tabs`: To track tab activations/updates so the Side Panel UI stays in sync.
- `host_permissions`: `https://generativelanguage.googleapis.com/*` for AI fetch requests, and `https://docs.google.com/forms/*` to ensure injection reliability from the Side Panel context.

---

## 🛠 Important Implementation Details & Rules

1. **DOM Selectors in Google Forms change often.** 
   - `content.js` uses generic structural cues (`[data-params]`, `[role="heading"]`, `[role="radio"]`) rather than strict class names (like `.M7eMe`) as much as possible. Do not hardcode internal Google Form IDs (e.g., `entry.12345`).
2. **Event Dispatching.** 
   - Standard `input.value = "test"` will NOT work on Google Forms. Always use the native setter bypass and `dispatchInputEvents()` implemented in `content.js`.
3. **Fuzzy Matching.** 
   - String comparisons between AI mappings, learned mappings, and dropdown/radio options rely on the `fuzzyMatch()` and `normalizeQuestion()` functions. Do not use strict `===` for user-facing text.
4. **Error Handling.** 
   - The Gemini API free tier often returns `429 Too Many Requests` due to high demand. `ai.js` catches this, but the UI must gracefully handle it without breaking.
   - `chrome.scripting.executeScript` might fail if the tab is a restricted URL. `checkActiveTab()` ensures we are on a valid Google Form before allowing a scan.

---

## 🚀 Future Roadmap / Potential Next Tasks
- **Encryption**: Currently, API keys and knowledge base data are stored in plaintext in `chrome.storage.local`. Implementing lightweight AES encryption could be useful if users store sensitive data (SSN, credit cards).
- **Undo Learning**: The ability to manually delete or edit a specific "Learned" mapping if the user accidentally saved an incorrect fill.
- **Multi-page Forms**: Handling Google Forms that span multiple pages (currently, it only scans the visible page).
