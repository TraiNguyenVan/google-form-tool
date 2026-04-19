// FormFill Pro — Content Script
// Runs on Google Forms pages to detect and fill form fields

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // FIELD TYPE CONSTANTS
  // ═══════════════════════════════════════════════════════════
  const FIELD_TYPES = {
    SHORT_TEXT: 'short_text',
    PARAGRAPH: 'paragraph',
    RADIO: 'radio',
    CHECKBOX: 'checkbox',
    DROPDOWN: 'dropdown',
    DATE: 'date',
    TIME: 'time',
    LINEAR_SCALE: 'linear_scale',
    CHECKBOX_GRID: 'checkbox_grid',
    RADIO_GRID: 'radio_grid',
    FILE_UPLOAD: 'file_upload',
    UNKNOWN: 'unknown'
  };

  // ═══════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Normalize text for comparison (lowercase, trim, collapse whitespace)
   */
  function normalizeText(text) {
    return (text || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Simple fuzzy match — checks if strings are similar enough
   */
  function fuzzyMatch(a, b, threshold = 0.7) {
    const na = normalizeText(a);
    const nb = normalizeText(b);
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;

    // Levenshtein-based similarity
    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return true;
    const distance = levenshteinDistance(na, nb);
    return (1 - distance / maxLen) >= threshold;
  }

  function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b[i - 1] === a[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Dispatch synthetic events to make Google Forms register value changes
   */
  function dispatchInputEvents(element) {
    element.dispatchEvent(new Event('focus', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  /**
   * Simulate a real mouse click on an element
   */
  function simulateClick(element) {
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  /**
   * Wait for a condition to be true
   */
  function waitFor(predicate, timeout = 3000, interval = 100) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const result = predicate();
        if (result) {
          resolve(result);
        } else if (Date.now() - start > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, interval);
        }
      };
      check();
    });
  }

  /**
   * Small delay helper
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ═══════════════════════════════════════════════════════════
  // FIELD DETECTION
  // ═══════════════════════════════════════════════════════════

  /**
   * Get all question containers on the page.
   * Google Forms wraps each question in a container with `data-params`.
   */
  function getQuestionContainers() {
    // Primary selector: elements with data-params containing question metadata
    let containers = Array.from(document.querySelectorAll('[data-params]'));

    // Filter to only actual question containers (they have specific parent structure)
    containers = containers.filter(el => {
      // Must have visible question text
      const hasText = el.querySelector('[role="heading"]') ||
        el.querySelector('.M7eMe') ||
        el.querySelector('[dir="auto"]');
      return hasText;
    });

    // Fallback: look for the common question wrapper pattern
    if (containers.length === 0) {
      containers = Array.from(document.querySelectorAll('div[jsmodel]')).filter(el => {
        return el.querySelector('input, textarea, [role="radio"], [role="checkbox"], [role="listbox"]');
      });
    }

    return containers;
  }

  /**
   * Extract the question label from a container
   */
  function getQuestionLabel(container) {
    // Try heading role first
    const heading = container.querySelector('[role="heading"]');
    if (heading) {
      // Get the text but exclude the required asterisk
      const text = heading.textContent.replace(/\*$/, '').trim();
      if (text) return text;
    }

    // Try common label selectors
    const selectors = [
      '.M7eMe',         // Common label class (may change)
      '[dir="auto"]',   // Direction-aware text
      '.freebirdFormviewerComponentsQuestionBaseTitle'
    ];

    for (const sel of selectors) {
      const el = container.querySelector(sel);
      if (el && el.textContent.trim()) {
        return el.textContent.replace(/\*$/, '').trim();
      }
    }

    // Last resort: first substantial text content
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text.length > 2 && text !== '*') return text;
    }

    return 'Untitled Question';
  }

  /**
   * Determine the field type of a question container
   */
  function detectFieldType(container) {
    // Check for text input
    const textInput = container.querySelector('input[type="text"]:not([aria-label*="Hour"]):not([aria-label*="Minute"]):not([aria-label*="Day"]):not([aria-label*="Month"]):not([aria-label*="Year"])');
    if (textInput && !container.querySelector('[role="radio"]') && !container.querySelector('[role="listbox"]')) {
      return FIELD_TYPES.SHORT_TEXT;
    }

    // Check for paragraph (textarea)
    if (container.querySelector('textarea')) {
      return FIELD_TYPES.PARAGRAPH;
    }

    // Check for radio buttons
    if (container.querySelector('[role="radiogroup"]') || container.querySelectorAll('[role="radio"]').length > 0) {
      // Check if it's a linear scale (has numbered options in a row)
      const radios = container.querySelectorAll('[role="radio"]');
      if (radios.length > 0) {
        const labels = Array.from(radios).map(r => r.getAttribute('aria-label') || r.textContent.trim());
        const allNumeric = labels.every(l => /^\d+$/.test(l));
        if (allNumeric && radios.length >= 3) {
          return FIELD_TYPES.LINEAR_SCALE;
        }
      }
      // Check if it's a grid (has multiple radiogroups)
      const radioGroups = container.querySelectorAll('[role="radiogroup"]');
      if (radioGroups.length > 1) {
        return FIELD_TYPES.RADIO_GRID;
      }
      return FIELD_TYPES.RADIO;
    }

    // Check for checkboxes
    if (container.querySelectorAll('[role="checkbox"]').length > 0) {
      // Check if it's a checkbox grid
      const groups = container.querySelectorAll('[role="group"]');
      if (groups.length > 1) {
        return FIELD_TYPES.CHECKBOX_GRID;
      }
      return FIELD_TYPES.CHECKBOX;
    }

    // Check for dropdown
    if (container.querySelector('[role="listbox"]') || container.querySelector('[data-value]')) {
      return FIELD_TYPES.DROPDOWN;
    }

    // Check for date fields
    if (container.querySelector('[aria-label*="Day"]') || container.querySelector('[aria-label*="Month"]') ||
      container.querySelector('input[aria-label*="Year"]') || container.querySelector('[type="date"]')) {
      return FIELD_TYPES.DATE;
    }

    // Check for time fields
    if (container.querySelector('[aria-label*="Hour"]') || container.querySelector('[aria-label*="Minute"]')) {
      return FIELD_TYPES.TIME;
    }

    // Check for file upload
    if (container.querySelector('input[type="file"]') || container.textContent.includes('Add file')) {
      return FIELD_TYPES.FILE_UPLOAD;
    }

    // Generic text input fallback
    if (container.querySelector('input')) {
      return FIELD_TYPES.SHORT_TEXT;
    }

    return FIELD_TYPES.UNKNOWN;
  }

  /**
   * Get options for radio, checkbox, dropdown, or scale fields
   */
  function getFieldOptions(container, fieldType) {
    const options = [];

    switch (fieldType) {
      case FIELD_TYPES.RADIO:
      case FIELD_TYPES.LINEAR_SCALE: {
        const radios = container.querySelectorAll('[role="radio"]');
        radios.forEach(radio => {
          const label = radio.getAttribute('aria-label') ||
            radio.getAttribute('data-value') ||
            radio.textContent.trim();
          if (label) options.push(label);
        });
        break;
      }

      case FIELD_TYPES.CHECKBOX: {
        const checkboxes = container.querySelectorAll('[role="checkbox"]');
        checkboxes.forEach(cb => {
          const label = cb.getAttribute('aria-label') ||
            cb.getAttribute('data-answer-value') ||
            cb.textContent.trim();
          if (label) options.push(label);
        });
        break;
      }

      case FIELD_TYPES.DROPDOWN: {
        const listbox = container.querySelector('[role="listbox"]');
        if (listbox) {
          const items = listbox.querySelectorAll('[role="option"]');
          items.forEach(item => {
            const label = item.getAttribute('data-value') ||
              item.textContent.trim();
            if (label && label !== 'Choose') options.push(label);
          });
        }
        break;
      }
    }

    return options;
  }

  /**
   * Scan the entire form and return structured field data
   */
  function scanForm() {
    const containers = getQuestionContainers();
    const fields = [];

    containers.forEach((container, index) => {
      const fieldType = detectFieldType(container);
      if (fieldType === FIELD_TYPES.FILE_UPLOAD || fieldType === FIELD_TYPES.UNKNOWN) return;

      const label = getQuestionLabel(container);
      const options = getFieldOptions(container, fieldType);

      // Check if required
      const isRequired = container.querySelector('[aria-label*="Required"]') !== null ||
        container.textContent.includes('*') && container.querySelector('[aria-required="true"]') !== null;

      fields.push({
        index,
        label,
        type: fieldType,
        options,
        required: isRequired,
        value: '' // Current value (empty for scan)
      });
    });

    return fields;
  }

  // ═══════════════════════════════════════════════════════════
  // FIELD FILLING
  // ═══════════════════════════════════════════════════════════

  /**
   * Fill a short text input
   */
  function fillShortText(container, value) {
    const input = container.querySelector('input[type="text"]') ||
      container.querySelector('input:not([type="hidden"])');
    if (!input) return false;

    // Set the value using native setter to bypass React/Angular bindings
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(input, value);
    dispatchInputEvents(input);
    return true;
  }

  /**
   * Fill a paragraph (textarea) field
   */
  function fillParagraph(container, value) {
    const textarea = container.querySelector('textarea');
    if (!textarea) return false;

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeSetter.call(textarea, value);
    dispatchInputEvents(textarea);
    return true;
  }

  /**
   * Select a radio button by label
   */
  function fillRadio(container, value) {
    const radios = container.querySelectorAll('[role="radio"]');
    for (const radio of radios) {
      const label = radio.getAttribute('aria-label') ||
        radio.getAttribute('data-value') ||
        radio.textContent.trim();
      if (fuzzyMatch(label, value)) {
        simulateClick(radio);
        return true;
      }
    }
    return false;
  }

  /**
   * Select checkboxes by labels (value is comma-separated)
   */
  function fillCheckbox(container, value) {
    const selectedLabels = value.split(',').map(v => v.trim());
    const checkboxes = container.querySelectorAll('[role="checkbox"]');
    let filled = false;

    for (const cb of checkboxes) {
      const label = cb.getAttribute('aria-label') ||
        cb.getAttribute('data-answer-value') ||
        cb.textContent.trim();

      const shouldCheck = selectedLabels.some(sel => fuzzyMatch(label, sel));
      const isChecked = cb.getAttribute('aria-checked') === 'true';

      if (shouldCheck && !isChecked) {
        simulateClick(cb);
        filled = true;
      }
    }
    return filled;
  }

  /**
   * Select a dropdown option
   */
  async function fillDropdown(container, value) {
    // First, click to open the dropdown
    const dropdownTrigger = container.querySelector('[role="listbox"]') ||
      container.querySelector('[data-value]');

    if (!dropdownTrigger) return false;

    simulateClick(dropdownTrigger);

    // Wait for dropdown options to appear
    await delay(500);

    // Look for the option in the dropdown menu (may appear in a portal/overlay)
    const allOptions = document.querySelectorAll('[role="option"], [data-value]');
    for (const option of allOptions) {
      const optionLabel = option.getAttribute('data-value') ||
        option.textContent.trim();
      if (fuzzyMatch(optionLabel, value)) {
        simulateClick(option);
        return true;
      }
    }

    // Close dropdown if no match found
    document.body.click();
    return false;
  }

  /**
   * Fill date fields (value format: "YYYY-MM-DD" or "MM/DD/YYYY")
   */
  function fillDate(container, value) {
    // Parse the date value
    let day, month, year;
    if (value.includes('-')) {
      [year, month, day] = value.split('-');
    } else if (value.includes('/')) {
      [month, day, year] = value.split('/');
    } else {
      return false;
    }

    const dayInput = container.querySelector('[aria-label*="Day"]') ||
      container.querySelector('input[placeholder*="DD"]');
    const monthInput = container.querySelector('[aria-label*="Month"]') ||
      container.querySelector('input[placeholder*="MM"]');
    const yearInput = container.querySelector('[aria-label*="Year"]') ||
      container.querySelector('input[placeholder*="YYYY"]');

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;

    if (dayInput) {
      nativeSetter.call(dayInput, parseInt(day, 10).toString());
      dispatchInputEvents(dayInput);
    }
    if (monthInput) {
      // Month might be a dropdown
      if (monthInput.getAttribute('role') === 'listbox') {
        simulateClick(monthInput);
        // Select month option
      } else {
        nativeSetter.call(monthInput, parseInt(month, 10).toString());
        dispatchInputEvents(monthInput);
      }
    }
    if (yearInput) {
      nativeSetter.call(yearInput, year);
      dispatchInputEvents(yearInput);
    }

    return !!(dayInput || monthInput || yearInput);
  }

  /**
   * Fill time fields (value format: "HH:MM")
   */
  function fillTime(container, value) {
    const [hours, minutes] = value.split(':');

    const hourInput = container.querySelector('[aria-label*="Hour"]');
    const minuteInput = container.querySelector('[aria-label*="Minute"]');

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;

    if (hourInput) {
      nativeSetter.call(hourInput, parseInt(hours, 10).toString());
      dispatchInputEvents(hourInput);
    }
    if (minuteInput) {
      nativeSetter.call(minuteInput, parseInt(minutes, 10).toString());
      dispatchInputEvents(minuteInput);
    }

    return !!(hourInput || minuteInput);
  }

  /**
   * Select a linear scale value
   */
  function fillLinearScale(container, value) {
    const radios = container.querySelectorAll('[role="radio"]');
    for (const radio of radios) {
      const label = radio.getAttribute('aria-label') ||
        radio.getAttribute('data-value') ||
        radio.textContent.trim();
      if (label === value.toString()) {
        simulateClick(radio);
        return true;
      }
    }
    return false;
  }

  /**
   * Fill a single field based on its type
   */
  async function fillField(container, fieldType, value) {
    if (!value && value !== 0) return false;

    switch (fieldType) {
      case FIELD_TYPES.SHORT_TEXT:
        return fillShortText(container, value);
      case FIELD_TYPES.PARAGRAPH:
        return fillParagraph(container, value);
      case FIELD_TYPES.RADIO:
        return fillRadio(container, value);
      case FIELD_TYPES.CHECKBOX:
        return fillCheckbox(container, value);
      case FIELD_TYPES.DROPDOWN:
        return await fillDropdown(container, value);
      case FIELD_TYPES.DATE:
        return fillDate(container, value);
      case FIELD_TYPES.TIME:
        return fillTime(container, value);
      case FIELD_TYPES.LINEAR_SCALE:
        return fillLinearScale(container, value);
      default:
        return false;
    }
  }

  /**
   * Fill the entire form with profile data
   */
  async function fillForm(profileFields) {
    const containers = getQuestionContainers();
    const results = { filled: 0, failed: 0, skipped: 0, details: [] };

    for (const profileField of profileFields) {
      if (!profileField.value && profileField.value !== 0) {
        results.skipped++;
        results.details.push({ label: profileField.label, status: 'skipped' });
        continue;
      }

      let matched = false;

      // Try label-based matching first
      for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
        const containerLabel = getQuestionLabel(container);

        if (fuzzyMatch(containerLabel, profileField.label)) {
          const fieldType = detectFieldType(container);
          const success = await fillField(container, fieldType, profileField.value);

          if (success) {
            results.filled++;
            results.details.push({ label: profileField.label, status: 'filled' });
          } else {
            results.failed++;
            results.details.push({ label: profileField.label, status: 'failed' });
          }
          matched = true;
          break;
        }
      }

      // Fall back to index-based matching
      if (!matched && profileField.index !== undefined && containers[profileField.index]) {
        const container = containers[profileField.index];
        const fieldType = detectFieldType(container);
        const success = await fillField(container, fieldType, profileField.value);

        if (success) {
          results.filled++;
          results.details.push({ label: profileField.label, status: 'filled (by index)' });
        } else {
          results.failed++;
          results.details.push({ label: profileField.label, status: 'failed' });
        }
        matched = true;
      }

      if (!matched) {
        results.failed++;
        results.details.push({ label: profileField.label, status: 'not found' });
      }

      // Small delay between fills to avoid rate limiting
      await delay(150);
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // MESSAGE HANDLER
  // ═══════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'scanForm': {
        const fields = scanForm();
        sendResponse({ success: true, fields });
        break;
      }

      case 'fillForm': {
        fillForm(message.fields).then(results => {
          sendResponse({ success: true, results });
        }).catch(err => {
          sendResponse({ success: false, error: err.message });
        });
        return true; // Keep channel open for async response
      }

      case 'ping': {
        sendResponse({ success: true, message: 'Content script is active' });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }

    return true; // Keep the message channel open
  });

  // Notify that content script is loaded
  console.log('🚀 FormFill Pro content script loaded on Google Forms');
})();
