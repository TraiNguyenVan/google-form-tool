# Tools & Modules

| Module Name | File | Purpose | Key Functions | Side Effects |
| --- | --- | --- | --- | --- |
| Knowledge Base & Learning Engine | `knowledge.js` | Manages user data and mappings. | `learnFromFill()` | Auto-creates custom keys in `kb.custom` based on AI suggestions. Modifies local storage. |
| AI Integration | `ai.js` | Communicates with the `gemini-2.5-flash` API. | | Makes network requests to Google Generative Language API. Catch `429 Too Many Requests`. |
| Content Script | `content.js` | Reads and manipulates the Google Forms DOM. | `scanForm()`, `fillForm()`, `fuzzyMatch()`, `normalizeQuestion()`, `dispatchInputEvents()` | Dispatches synthetic UI events. Uses native setters on DOM elements. |
| Popup / Side Panel | `popup.js` | Manages the main user interface. | | Sends messages to `content.js` via `chrome.tabs.sendMessage` with retry logic. |
| Background Service Worker | `background.js` | Initializes extension and manages Context Menus. | | Creates context menus. Modifies default `chrome.storage.local` on install. |
| Manifest | `manifest.json` | Configures permissions and entry points. | | Grants broad host permissions and storage/scripting rights. |
