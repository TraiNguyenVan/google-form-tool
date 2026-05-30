# FormFill Pro — Google Form Auto-Fill

<p align="center">
  <strong>🛟 Your survival kit for the Google Form hellscape of Vietnamese university life.</strong>
</p>

---

## The Origin Story 😮‍💨

If you're a Vietnamese college student, you know the drill:

<div align="center">
  <table><tr><td>

  > *"Sinh viên vui lòng điền form đăng ký hoạt động để được cộng **điểm rèn luyện**."*
  >
  > *"Mỗi bạn điền ít nhất 3 form khảo sát / tuần."*
  >
  > *"Vui lòng điền đầy đủ họ tên, MSSV, lớp, khoa, email, SĐT..."*

  </td></tr></table>
</div>

<br>

<p align="center">
  <img src="https://images.meme-arsenal.com/499d5e192b5f6be902a5c624d5bea1d3.jpg" alt="điểm rèn luyện meme" width="420">
</p>

Sound familiar? Copy-pasting your name, student ID, class, faculty, email, and phone number into the same Google Form for the 47th time this semester. Whether it's for **điểm rèn luyện**, club registration, event check-in, course feedback, or yet another "khảo sát ý kiến sinh viên" — it's the same data every single time.

**FormFill Pro** is the Chrome Extension that fills these forms *for you*, so you can get back to what actually matters: sleeping, cramming, or pretending you didn't just miss another deadline.

## What It Does

| Pain Point | FormFill Pro's Answer |
|---|---|
| Typing MSSV, họ tên, lớp, khoa... on every form | One click Smart Fill across any Google Form |
| "Which form is this again?" | AI scans questions → auto-maps to your data |
| 50+ forms per semester, same info every time | Learning Engine remembers — fewer AI calls over time |
| Forms in Vietnamese or English | Works with both — fuzzy matching handles variations |
| Đoàn/Khoa sends form at 11pm, due at 11:59pm | Fill it in 5 seconds, go back to sleep |

## Features

- **⚡ Smart Fill** — Open any Google Form, click Scan, then Smart Fill. Done. The AI maps every question to your personal data.
- **🧠 Learning Engine** — After each fill, the extension learns the question → field mapping. Next time the same form shows up, zero AI calls needed — instant fill.
- **📋 Knowledge Base** — Store your info once (MSSV, họ tên, lớp, khoa, email, SĐT, etc.) organized by category. Add custom fields for anything.
- **🤖 AI Import** — Paste your bio, resume, or CV text. Gemini extracts structured data straight into your Knowledge Base.
- **🔍 10+ Field Types** — Detects and fills: short text, paragraph, radio buttons, checkboxes, dropdowns, dates, times, linear scales, checkbox grids, radio grids.
- **🟢 Confidence Scores** — Green/yellow/red indicators show how sure the AI is about each mapping, so you know what to double-check.
- **🔒 Privacy First** — Only the question labels (e.g., "Họ và tên") go to the AI. Your actual personal data values never leave your browser.

## Quickstart

```bash
git clone https://github.com/TraiNguyenVan/google-form-tool
```

```
1. Chrome → chrome://extensions/ → Enable Developer Mode
2. "Load unpacked" → select the cloned folder
3. Get a free Gemini API key from https://aistudio.google.com/apikey
4. Open Side Panel → "My Data" tab → enter API key
5. Fill in your info (or paste your CV text → "Extract with AI")
6. Open any Google Form → click "Scan Form" → "Smart Fill" → 🎉
```

No `npm install`, no build tools, no frameworks. Just vanilla JavaScript and Chrome.

## How It Works

```
  ┌────────────────────────────────────────────┐
  │           Google Form Page                 │
  │                                            │
  │  ┌──────────────────────────────────────┐  │
  │  │  content.js                          │  │
  │  │  • Scans question containers         │  │
  │  │  • Detects field types               │  │
  │  │  • Fills using native setter bypass  │  │
  │  └───────────┬──────────────────────────┘  │
  └──────────────┼─────────────────────────────┘
                 │ chrome.tabs.sendMessage()
  ┌──────────────▼─────────────────────────────┐
  │           Side Panel UI                    │
  │                                            │
  │  ┌─────────────┐  ┌────────────────────┐  │
  │  │ knowledge.js│  │  ai.js (Gemini)    │  │
  │  │             │  │                    │  │
  │  │ • Your data │  │ • Classify fields  │  │
  │  │ • Mappings  │  │ • Extract from text│  │
  │  │ • Learning  │  │ • Smart resolve    │  │
  │  └─────────────┘  └────────────────────┘  │
  └───────────────────────────────────────────┘
```

### Smart Fill Flow
1. **Scan** — Detects all questions and field types on the form
2. **Learned?** — Checks if you've filled this type of form before → skip AI
3. **AI Classify** — Sends only question labels (not your data!) to Gemini for mapping
4. **Fill** — Hits every field with your data using native DOM setters (bypasses React/Angular)
5. **Learn** — Saves the new mapping for next time

## Tech Stack

| Layer | What |
|---|---|
| **Platform** | Chrome Extension Manifest V3 |
| **Language** | Vanilla JavaScript ES6+ |
| **AI Model** | Gemini 2.5 Flash |
| **Storage** | chrome.storage.local |
| **Permissions** | storage, activeTab, scripting, sidePanel, tabs |
| **Dependencies** | None. Zero. Zilch. |

## Project Structure

```
google-form-tool/
├── manifest.json          # Extension manifest (v1.1.0)
├── background.js          # Service worker
├── content.js             # DOM scanning & form filling
├── knowledge.js           # Knowledge Base & Learning Engine
├── ai.js                  # Gemini API integration
├── popup.js               # UI logic (side panel + popup)
├── popup.html / popup.css # Popup fallback + stylesheet
├── sidepanel.html         # Primary 3-tab UI
├── icons/                 # Extension icons
├── SETUP.md               # Setup guide
├── ARCHITECTURE.md        # Module map & data flow
├── SECURITY.md            # Threat model & privacy
├── ROADMAP.md             # Upcoming features
└── LICENSE                # MIT
```

## Knowledge Base Categories

| Category | What goes here |
|---|---|
| `identity` | Họ và tên, Ngày sinh, Giới tính |
| `contact` | Email, SĐT |
| `address` | Địa chỉ, Thành phố, Quê quán |
| `education` | MSSV, Trường, Khoa, Lớp, Ngành, Khóa |
| `work` | Công ty, Chức vụ (for internships) |
| `personal` | Sở thích, Kỹ năng, Tiểu sử |
| `custom` | Auto-created from AI suggestions (anything!) |

## Roadmap

| Priority | Task |
|---|---|
| 1 | Undo / edit learned mappings |
| 2 | AES encryption for stored data |
| 3 | Multi-page form support |

See [ROADMAP.md](ROADMAP.md).

## Security

API key and Knowledge Base are stored in plaintext (`chrome.storage.local`) — AES encryption is on the roadmap. Your personal data values are **never** sent to Gemini during form classification — only question labels go to the API. See [SECURITY.md](SECURITY.md).

## Contributing

PRs welcome! Read [ARCHITECTURE.md](ARCHITECTURE.md) and [AGENT_SPEC.md](AGENT_SPEC.md) first.

## License

MIT — see [LICENSE](LICENSE).

---

<p align="center">
  <sub>Built with caffeine and spite by a student who got tired of filling forms. 🧋</sub>
</p>
