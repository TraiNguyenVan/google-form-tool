# FormFill Pro — Google Form Auto-Fill

> Smart AI-powered auto-fill for Google Forms — from static profiles to a learning assistant.

**FormFill Pro** is a Chrome Extension (Manifest V3) that intelligently auto-fills Google Forms. It combines a local Knowledge Base, a self-improving Learning Engine, and Google's Gemini AI to remember your answers and fill forms with one click. Primarily built for students tackling repetitive surveys, forms, and applications.

<p align="center">
  <img src="icons/icon128.png" alt="FormFill Pro icon" width="64">
</p>

---

## Features

- **Smart Fill** — Scan any Google Form, let the AI classify questions against your personal data, and fill every field automatically with confidence scores.
- **Learning Engine** — The extension remembers which questions map to which data fields. The more you use it, the less it calls the AI.
- **Knowledge Base** — Manage your personal data organized into categories: identity, contact, address, education, work, personal, and custom fields.
- **Natural Language Import** — Paste unstructured text (resume, bio, intro paragraph) and let Gemini extract structured data from it.
- **Legacy Profiles** — Create and switch between named profiles for manual form filling when you need a different set of answers.
- **10+ Field Types** — Detects and fills short text, paragraph, radio, checkbox, dropdown, date, time, linear scale, checkbox grid, radio grid, and file upload fields.
- **Fuzzy Matching** — Handles label variations ("Full Name" vs "Your full name") using Levenshtein distance.
- **Confidence Visualization** — Green / yellow / red indicators show how confident the AI is about each field mapping.
- **Privacy First** — Only question labels and field keys go to the Gemini API. Your actual personal data values are never sent during classification.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Platform** | Chrome Extension (Manifest V3) |
| **Language** | Vanilla JavaScript (ES6+, `'use strict'`) |
| **AI** | [Gemini 2.5 Flash](https://ai.google.dev) (`gemini-2.5-flash`) |
| **Storage** | `chrome.storage.local` |
| **UI** | Chrome Side Panel + Popup (HTML/CSS) |
| **APIs** | `storage`, `activeTab`, `scripting`, `sidePanel`, `tabs` |
| **Dependencies** | **None** — no npm, no Webpack, no frameworks |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Side Panel (sidepanel.html + popup.js)             │
│  ┌───────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ knowledge │  │  ai.js   │  │  Tab Navigation │  │
│  │   .js     │  │ (Gemini) │  │  Smart Fill     │  │
│  │ KB CRUD   │  │ classify │  │  Profiles       │  │
│  │ Mappings  │  │ extract  │  │  My Data        │  │
│  │ Learn     │  │ resolve  │  └─────────────────┘  │
│  └─────┬─────┘  └────┬─────┘                       │
│        └──────────────┘                             │
└──────────────┬──────────────────────────────────────┘
               │ chrome.tabs.sendMessage()
               ▼
┌──────────────────────────────────────────────────────┐
│  Content Script (content.js)                         │
│  Injected into docs.google.com/forms/*               │
│  - Detects question containers & field types         │
│  - Fills fields via native setter bypass             │
│  - Dispatches synthetic events for React/Angular     │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│  Background Service Worker (background.js)           │
│  - Initializes default storage on install            │
│  - Configures Side Panel behavior                    │
└──────────────────────────────────────────────────────┘
```

### Data Flow: Smart Fill

1. **Scan** — `content.js` scans the form for question containers, extracts labels and field types.
2. **Check Learning** — `knowledge.js` checks if a learned mapping already exists for each question.
3. **AI Classify** — `ai.js` sends only unmapped question labels to Gemini, which returns field-to-data mappings with confidence scores.
4. **Fill** — User clicks "Smart Fill" → `content.js` fills each field using native setters and synthetic events with 150ms delays.
5. **Learn** — After a successful fill, new mappings are saved to the Learning Engine for next time.

## Project Structure

```
google-form-tool/
├── manifest.json          # Extension manifest (v1.1.0)
├── background.js          # Service worker — init & side panel setup
├── content.js             # Content script — DOM scanning & filling
├── knowledge.js           # Knowledge Base & Learning Engine
├── ai.js                  # Gemini AI integration
├── popup.js               # Main UI logic (side panel & popup)
├── popup.html             # Compact popup fallback
├── popup.css              # Full stylesheet (dark theme)
├── sidepanel.html         # Primary UI — 3-tab layout
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── SETUP.md               # Installation & configuration guide
├── ARCHITECTURE.md        # Module map & data flow diagrams
├── SECURITY.md            # Security analysis & threat model
├── ROADMAP.md             # Planned features
├── CHANGELOG.md           # Release notes
├── DECISIONS.md           # Architecture Decision Records
├── AGENT_SPEC.md          # Agent development constraints
├── SAFETY.md              # Error handling patterns
└── TOOLS.md               # Module reference table
```

## Getting Started

### Prerequisites

- **Google Chrome** version 88 or later (Manifest V3)
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey)

### Installation

```bash
git clone <repo-url> formfill-pro
```

1. Open Chrome, navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked** and select the project directory
4. The extension icon appears in your toolbar

### Configuration

1. Open a Google Form (`docs.google.com/forms/*`)
2. Click the extension icon or open the Side Panel
3. Go to the **My Data** tab
4. Enter your Gemini API key and click Save
5. Populate your Knowledge Base (or use Natural Language Import to extract data from text)

No build steps, no `npm install`, no frameworks — just load and go.

## Usage

### Smart Fill (Recommended)

1. Open any Google Form
2. Open the Side Panel → **Smart Fill** tab
3. Click **Scan Form** — the AI classifies every question
4. Review field mappings and confidence scores
5. Click **Smart Fill** — the form is filled automatically
6. The extension learns from this fill for next time

### Natural Language Import

1. Go to **My Data** tab
2. Scroll to "Import from Text"
3. Paste unstructured text (e.g., resume, bio)
4. Click **Extract with AI**
5. Review extracted data in the modal and confirm to save

### Legacy Profiles (No AI)

1. Go to **Profiles** tab
2. Create a new profile with fields and values
3. Switch to the form, scan, and fill manually

## Knowledge Base Categories

| Category | Example Fields |
|----------|---------------|
| `identity` | Name, Date of Birth, Gender, Pronouns |
| `contact` | Email, Phone, Mobile |
| `address` | Street, City, State, ZIP, Country |
| `education` | School, Major, Education Level, Graduation Year |
| `work` | Company, Job Title, Work Email, Years of Experience |
| `personal` | Interests, Skills, Hobbies, Languages, Bio |
| `custom` | Auto-created fields based on AI suggestions |

## Development

- **Language**: Vanilla JavaScript — no build tools, no transpilation
- **Module pattern**: `ai.js` and `knowledge.js` use IIFE closures, exposed to `window` for access by `popup.js`
- **Testing**: Currently manual — load the unpacked extension and test against live Google Forms
- **Code style**: JSDoc annotations, `'use strict'`, consistent comment dividers, CSS custom properties for theming

### Key Design Decisions

- **Native Setter Bypass** — Google Forms use React/Angular event bindings; `input.value = "x"` doesn't work. We use `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call()` and dispatch synthetic events.
- **Fuzzy Matching** — All string comparisons between AI mappings, learned mappings, and form options use Levenshtein distance with a 0.7 similarity threshold.
- **Side Panel UI** — Persistent panel stays open alongside the form, unlike a popup that closes on focus loss.
- **Privacy Boundary** — Only question labels and field keys reach the AI. Personal data values stay local.

## Roadmap

| Priority | Task | Complexity |
|----------|------|-----------|
| 1 | Undo / edit learned mappings | Medium |
| 2 | AES encryption for stored data | High |
| 3 | Multi-page form support | High |

See [ROADMAP.md](ROADMAP.md) for details.

## Security

The Gemini API key and Knowledge Base data are currently stored in plaintext in `chrome.storage.local`. AES encryption is planned. Only question labels and field keys are sent to the Gemini API — your personal data values never leave your browser during classification. See [SECURITY.md](SECURITY.md) for the full threat model.

## Contributing

Contributions are welcome. Before contributing, review:

- [ARCHITECTURE.md](ARCHITECTURE.md) — module map and data flow
- [AGENT_SPEC.md](AGENT_SPEC.md) — coding constraints (no hardcoded DOM IDs, always use fuzzy matching, native setters only)
- [TOOLS.md](TOOLS.md) — module reference

Open an issue to discuss proposed changes, then submit a PR against the `main` branch.

## License

This project is licensed under the [MIT License](LICENSE).
