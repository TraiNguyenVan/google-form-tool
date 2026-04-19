# FormFill Pro

## Overview
FormFill Pro is a Chrome Extension (Manifest V3) designed to intelligently auto-fill Google Forms. It evolved from a static, profile-based auto-filler into an AI-powered smart assistant using the Gemini API and a local Learning Engine.

## Who it's for
Primarily designed for college students to quickly auto-fill repetitive forms, surveys, and applications.

## Core Architecture Overview
The extension is split into distinct modules to separate UI, data management, AI operations, and DOM manipulation:
- A local Knowledge Base & Learning Engine (`knowledge.js`)
- AI Integration via Gemini API (`ai.js`)
- Content script for DOM reading and manipulation (`content.js`)
- UI operating primarily as a Side Panel / Popup (`popup.js`, `popup.css`, `popup.html`, `sidepanel.html`)
- Background Service Worker (`background.js`)

## Quickstart
1. Ensure you are using Google Chrome (version 88+).
2. Load the extension as an unpacked extension via `chrome://extensions/`.
3. For detailed setup instructions, see [SETUP.md](./SETUP.md).
