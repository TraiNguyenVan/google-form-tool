// FormFill Pro — Popup/Sidepanel Script
(function () {
  'use strict';

  // ─── DOM References ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const statusText = $('#statusText');
  const notFormWarning = $('#notFormWarning');
  const noApiWarning = $('#noApiWarning');
  const toast = $('#toast');

  // Tabs
  const tabs = $$('.tab');
  const tabContents = $$('.tab-content');

  // Smart Fill
  const scanBtn = $('#scanBtn');
  const smartFillBtn = $('#smartFillBtn');
  const learnBtn = $('#learnBtn');
  const fieldsList = $('#fieldsList'); // This is in smart fill tab
  const emptyState = $('#emptyState');

  // Profiles (Legacy)
  const profileSelect = $('#profileSelect');
  const newProfileBtn = $('#newProfileBtn');
  const deleteProfileBtn = $('#deleteProfileBtn');
  const importBtn = $('#importBtn');
  const exportBtn = $('#exportBtn');
  const importFile = $('#importFile');
  const fillBtn = $('#fillBtn'); // Legacy profile fill
  const saveProfileBtn = $('#saveProfileBtn');
  const profileFieldsList = $('#profileFieldsList');

  // Knowledge Base & Settings
  const apiKeyInput = $('#apiKeyInput');
  const testApiBtn = $('#testApiBtn');
  const saveKbBtn = $('#saveKbBtn');
  const kbEditor = $('#kbEditor');
  const customFieldsContainer = $('#customFields');
  const addCustomBtn = $('#addCustomBtn');
  const statMappings = $('#statMappings');
  const statFilled = $('#statFilled');
  const clearMappingsBtn = $('#clearMappingsBtn');

  // Modals
  const newProfileModal = $('#newProfileModal');
  const newProfileName = $('#newProfileName');
  const confirmNewProfile = $('#confirmNewProfile');
  const cancelNewProfile = $('#cancelNewProfile');

  const customFieldModal = $('#customFieldModal');
  const customFieldName = $('#customFieldName');
  const customFieldValue = $('#customFieldValue');
  const confirmCustomField = $('#confirmCustomField');
  const cancelCustomField = $('#cancelCustomField');

  // ─── State ───
  let currentFields = []; // Smart fill fields
  let profiles = [];
  let activeProfileId = null;
  let profileFields = []; // Fields for legacy profiles

  // ─── Init ───
  async function init() {
    await loadProfiles();
    await loadSettings();
    await renderKnowledgeBase();
    await updateStats();
    await checkActiveTab();
    bindEvents();

    // Tab listeners
    if (chrome.tabs && chrome.tabs.onActivated) {
      chrome.tabs.onActivated.addListener(() => checkActiveTab());
    }
    if (chrome.tabs && chrome.tabs.onUpdated) {
      chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.url || changeInfo.status === 'complete') checkActiveTab();
      });
    }
  }

  // ─── Tab Navigation ───
  function switchTab(tabId) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    tabContents.forEach(tc => tc.classList.toggle('active', tc.id === `tab-${tabId}`));
  }

  // ─── Active Tab Check ───
  async function checkActiveTab() {
    try {
      let activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTabs || activeTabs.length === 0) {
        activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      }
      const tab = activeTabs?.[0];

      if (!tab || !tab.url || !tab.url.includes('docs.google.com/forms')) {
        notFormWarning.style.display = 'flex';
        scanBtn.disabled = true;
        statusText.textContent = 'Not on a Google Form';
        return false;
      }
      notFormWarning.style.display = 'none';
      scanBtn.disabled = false;
      statusText.textContent = 'Ready';
      return true;
    } catch (e) {
      console.error('[FormFill Pro] Tab check error:', e);
      notFormWarning.style.display = 'flex';
      scanBtn.disabled = true;
      return false;
    }
  }

  // ─── Settings & KB ───
  async function loadSettings() {
    const key = await Knowledge.getApiKey();
    apiKeyInput.value = key;
    noApiWarning.style.display = key ? 'none' : 'flex';
  }

  async function renderKnowledgeBase() {
    const kb = await Knowledge.getKnowledgeBase();
    kbEditor.innerHTML = '';

    for (const [cat, fields] of Object.entries(kb)) {
      if (cat === 'custom') continue; // Handle custom separately

      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'kb-category';
      
      const filledCount = Object.values(fields).filter(v => !!v).length;
      const totalCount = Object.keys(fields).length;

      categoryDiv.innerHTML = `
        <div class="kb-category-header">
          <svg class="kb-category-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span class="kb-category-title">${Knowledge.CATEGORY_LABELS[cat] || cat}</span>
          <span class="kb-category-count">${filledCount}/${totalCount}</span>
        </div>
        <div class="kb-category-fields"></div>
      `;

      const fieldsContainer = categoryDiv.querySelector('.kb-category-fields');
      for (const [field, value] of Object.entries(fields)) {
        const fieldRow = document.createElement('div');
        fieldRow.className = 'kb-field';
        fieldRow.innerHTML = `
          <label class="kb-field-label">${Knowledge.FIELD_LABELS[field] || field}</label>
          <input type="text" class="kb-field-input" data-path="${cat}.${field}" value="${escapeHtml(value)}">
        `;
        fieldsContainer.appendChild(fieldRow);
      }

      // Toggle category
      categoryDiv.querySelector('.kb-category-header').addEventListener('click', () => {
        categoryDiv.classList.toggle('open');
      });

      kbEditor.appendChild(categoryDiv);
    }

    // Render Custom fields
    renderCustomFields(kb.custom);
  }

  function renderCustomFields(customData) {
    customFieldsContainer.innerHTML = '';
    const keys = Object.keys(customData);
    
    if (keys.length === 0) {
      customFieldsContainer.innerHTML = '<div class="empty-custom">No custom fields yet. Add one!</div>';
      return;
    }

    for (const [key, value] of Object.entries(customData)) {
      const row = document.createElement('div');
      row.className = 'custom-field-row';
      row.innerHTML = `
        <input type="text" class="field-input" value="${escapeHtml(key)}" disabled style="width: 30%;">
        <input type="text" class="field-input kb-custom-input" data-key="${escapeHtml(key)}" value="${escapeHtml(value)}">
        <button class="icon-btn small danger delete-custom-btn" data-key="${escapeHtml(key)}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
      customFieldsContainer.appendChild(row);
    }

    // Bind delete buttons
    customFieldsContainer.querySelectorAll('.delete-custom-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const keyToDelete = e.currentTarget.dataset.key;
        const kb = await Knowledge.getKnowledgeBase();
        delete kb.custom[keyToDelete];
        await Knowledge.saveKnowledgeBase(kb);
        renderCustomFields(kb.custom);
        showToast('Custom field deleted');
      });
    });
  }

  async function saveKnowledgeBaseUI() {
    const kb = await Knowledge.getKnowledgeBase();
    
    // Save standard fields
    kbEditor.querySelectorAll('.kb-field-input').forEach(input => {
      const [cat, field] = input.dataset.path.split('.');
      if (kb[cat] !== undefined) {
        kb[cat][field] = input.value;
      }
    });

    // Save custom fields
    customFieldsContainer.querySelectorAll('.kb-custom-input').forEach(input => {
      kb.custom[input.dataset.key] = input.value;
    });

    await Knowledge.saveKnowledgeBase(kb);
    await renderKnowledgeBase(); // refresh counts
    await updateStats();
    showToast('Knowledge Base saved', 'success');
  }

  async function updateStats() {
    const stats = await Knowledge.getStats();
    statMappings.textContent = stats.learnedMappings;
    statFilled.textContent = stats.filledFields;
    $('#mappingCount').textContent = stats.learnedMappings;
  }

  // ─── Smart Fill Flow ───

  async function scanFormSmart() {
    const onForm = await checkActiveTab();
    if (!onForm) return;

    const apiKey = await Knowledge.getApiKey();
    if (!apiKey) {
      switchTab('mydata');
      showToast('API key required for Smart Fill', 'error');
      return;
    }

    scanBtn.classList.add('scanning');
    scanBtn.disabled = true;
    statusText.textContent = 'Scanning & Classifying...';

    // Skeleton
    fieldsList.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const skel = document.createElement('div');
      skel.className = 'field-skeleton';
      fieldsList.appendChild(skel);
    }

    try {
      let activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTabs || activeTabs.length === 0) activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tab = activeTabs?.[0];

      // Try to inject the script
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise(r => setTimeout(r, 500)); // Wait longer for initialization
      } catch (e) {
        console.log('[FormFill Pro] Script may already exist or injection failed:', e);
      }

      // Retry logic for sending message
      let response = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await chrome.tabs.sendMessage(tab.id, { action: 'scanForm' });
          if (response) break;
        } catch (e) {
          if (attempt === 2) throw e;
          console.log(`[FormFill Pro] Send message attempt ${attempt + 1} failed, retrying...`);
          await new Promise(r => setTimeout(r, 500));
        }
      }

      if (response && response.success && response.fields.length > 0) {
        const rawFields = response.fields;
        statusText.textContent = 'AI is thinking...';
        
        // Smart Resolve!
        currentFields = await AI.smartResolve(rawFields, apiKey);
        
        renderSmartFields();
        smartFillBtn.disabled = false;
        learnBtn.disabled = false;
        statusText.textContent = `${currentFields.length} fields classified`;
        showToast(`Classified ${currentFields.length} fields`, 'success');
      } else {
        fieldsList.innerHTML = '';
        emptyState.style.display = 'flex';
        fieldsList.appendChild(emptyState);
        statusText.textContent = 'No fields found';
      }
    } catch (err) {
      console.error('Scan error:', err);
      fieldsList.innerHTML = '';
      emptyState.style.display = 'flex';
      fieldsList.appendChild(emptyState);
      statusText.textContent = 'Scan failed';
      showToast(err.message || 'Could not scan form', 'error');
    }

    scanBtn.classList.remove('scanning');
    scanBtn.disabled = false;
  }

  function renderSmartFields() {
    fieldsList.innerHTML = '';
    if (currentFields.length === 0) {
      emptyState.style.display = 'flex';
      fieldsList.appendChild(emptyState);
      return;
    }
    emptyState.style.display = 'none';

    currentFields.forEach((field, idx) => {
      const card = document.createElement('div');
      card.className = 'field-card';
      card.dataset.index = idx;

      // Confidence badge
      let confClass = 'low';
      let confText = 'Low Confidence';
      if (field.confidence >= 0.9) { confClass = 'high'; confText = 'High Confidence'; }
      else if (field.confidence >= 0.7) { confClass = 'medium'; confText = 'Medium Confidence'; }

      // Source badge
      let sourceLabel = field.source === 'learned' ? 'Learned' : (field.source === 'ai' ? 'AI' : 'Unknown');
      
      let mappingHtml = field.mapping ? `
        <div class="field-mapping">
          <div class="confidence-dot ${confClass}" title="${confText}"></div>
          <span class="mapping-tag">${field.mapping}</span>
          <span class="field-source ${field.source || 'none'}">${sourceLabel}</span>
        </div>
      ` : `<div class="field-mapping"><span class="field-source none">Unmapped</span></div>`;

      let valueHtml = '';
      switch (field.type) {
        case 'radio':
        case 'dropdown':
        case 'linear_scale':
          valueHtml = buildSelectInput(field, currentFields);
          break;
        case 'checkbox':
          valueHtml = buildCheckboxPills(field, currentFields);
          break;
        case 'date':
          valueHtml = `<div class="field-value-row"><input type="date" class="field-input smart-input" data-field-idx="${idx}" value="${field.value || ''}"></div>`;
          break;
        case 'time':
          valueHtml = `<div class="field-value-row"><input type="time" class="field-input smart-input" data-field-idx="${idx}" value="${field.value || ''}"></div>`;
          break;
        case 'paragraph':
          valueHtml = `<div class="field-value-row"><textarea class="field-input smart-input" data-field-idx="${idx}" placeholder="Enter value..." rows="2">${field.value || ''}</textarea></div>`;
          break;
        default:
          valueHtml = `<div class="field-value-row"><input type="text" class="field-input smart-input" data-field-idx="${idx}" value="${field.value || ''}" placeholder="Enter value..."></div>`;
      }

      card.innerHTML = `
        <div class="field-card-header">
          <div style="display:flex; flex-direction:column; gap:4px; overflow:hidden;">
            <span class="field-label" title="${escapeHtml(field.label)}">${escapeHtml(field.label)}</span>
            ${mappingHtml}
          </div>
        </div>
        ${valueHtml}
      `;

      fieldsList.appendChild(card);
    });

    bindCheckboxPills(fieldsList);
  }

  async function executeSmartFill() {
    readFieldValuesFromUI(fieldsList, currentFields, '.smart-input');
    const fieldsToFill = currentFields.filter(f => f.value);

    if (fieldsToFill.length === 0) {
      showToast('No values to fill', 'error');
      return;
    }

    smartFillBtn.disabled = true;
    statusText.textContent = 'Filling...';

    try {
      let activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTabs || activeTabs.length === 0) activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tab = activeTabs?.[0];

      let response = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await chrome.tabs.sendMessage(tab.id, {
            action: 'fillForm',
            fields: fieldsToFill
          });
          if (response) break;
        } catch (e) {
          if (attempt === 2) throw e;
          await new Promise(r => setTimeout(r, 500));
        }
      }

      if (response && response.success) {
        statusText.textContent = 'Filled!';
        showToast('Form filled successfully', 'success');
        
        // Auto-learn after successful fill
        learnFromCurrent();
      } else {
        showToast('Fill failed', 'error');
      }
    } catch (err) {
      console.error('Fill error:', err);
      showToast('Could not fill form', 'error');
    }

    smartFillBtn.disabled = false;
  }

  async function learnFromCurrent() {
    readFieldValuesFromUI(fieldsList, currentFields, '.smart-input');
    
    // Only learn fields that have a mapping and a value
    const toLearn = currentFields.filter(f => f.mapping && f.value);
    
    if (toLearn.length > 0) {
      const newLearned = await Knowledge.learnFromFill(toLearn);
      await updateStats();
      if (newLearned > 0) {
        showToast(`Learned ${newLearned} new mappings!`, 'success');
      } else {
        showToast(`Knowledge base updated`, 'info');
      }
      
      // Update UI to show source=learned
      currentFields.forEach(f => {
        if (f.mapping && f.value) {
          f.source = 'learned';
          f.confidence = 1.0;
        }
      });
      renderSmartFields();
      await renderKnowledgeBase();
    }
  }

  // ─── Legacy Profiles Flow (Kept minimal) ───

  async function loadProfiles() {
    const data = await chrome.storage.local.get(['profiles', 'activeProfileId']);
    profiles = data.profiles || [];
    activeProfileId = data.activeProfileId || null;
    renderProfileSelect();
  }

  function renderProfileSelect() {
    profileSelect.innerHTML = '<option value="">— Select profile —</option>';
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === activeProfileId) opt.selected = true;
      profileSelect.appendChild(opt);
    });
  }

  // Simplified profile rendering (similar to old UI)
  function renderProfileFields() {
    profileFieldsList.innerHTML = '';
    if (!profileFields || profileFields.length === 0) {
      profileFieldsList.innerHTML = '<div class="empty-state"><p>No fields in profile. Switch to Smart Fill to scan.</p></div>';
      return;
    }

    profileFields.forEach((field, idx) => {
      const card = document.createElement('div');
      card.className = 'field-card';
      
      let valueHtml = '';
      if (['radio', 'dropdown', 'linear_scale'].includes(field.type)) valueHtml = buildSelectInput(field, profileFields);
      else if (field.type === 'checkbox') valueHtml = buildCheckboxPills(field, profileFields);
      else valueHtml = `<div class="field-value-row"><input type="text" class="field-input prof-input" data-field-idx="${idx}" value="${escapeHtml(field.value || '')}"></div>`;

      card.innerHTML = `
        <div class="field-card-header"><span class="field-label">${escapeHtml(field.label)}</span></div>
        ${valueHtml}
      `;
      profileFieldsList.appendChild(card);
    });
    bindCheckboxPills(profileFieldsList);
  }

  async function executeLegacyFill() {
    readFieldValuesFromUI(profileFieldsList, profileFields, '.prof-input');
    const fieldsToFill = profileFields.filter(f => f.value);
    if (fieldsToFill.length === 0) return;

    fillBtn.disabled = true;
    try {
      let activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTabs || activeTabs.length === 0) activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tab = activeTabs?.[0];
      
      let response = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await chrome.tabs.sendMessage(tab.id, { action: 'fillForm', fields: fieldsToFill });
          if (response) break;
        } catch (e) {
          if (attempt === 2) throw e;
          await new Promise(r => setTimeout(r, 500));
        }
      }
      showToast('Profile filled!', 'success');
    } catch (err) {
      showToast('Fill error', 'error');
    }
    fillBtn.disabled = false;
  }

  // ─── Shared UI Helpers ───

  function buildSelectInput(field, fieldArray) {
    if (!field.options || field.options.length === 0) {
      return `<div class="field-value-row"><input type="text" class="field-input smart-input prof-input" data-field-idx="${fieldArray.indexOf(field)}" value="${escapeHtml(field.value || '')}" placeholder="Enter value..."></div>`;
    }
    let html = `<div class="field-value-row"><select class="field-select smart-input prof-input" data-field-idx="${fieldArray.indexOf(field)}">`;
    html += '<option value="">— Select —</option>';
    field.options.forEach(opt => {
      const selected = field.value === opt ? 'selected' : '';
      html += `<option value="${escapeHtml(opt)}" ${selected}>${escapeHtml(opt)}</option>`;
    });
    html += '</select></div>';
    return html;
  }

  function buildCheckboxPills(field, fieldArray) {
    if (!field.options || field.options.length === 0) {
      return `<div class="field-value-row"><input type="text" class="field-input smart-input prof-input" data-field-idx="${fieldArray.indexOf(field)}" value="${escapeHtml(field.value || '')}"></div>`;
    }
    const selectedValues = (field.value || '').split(',').map(v => v.trim()).filter(Boolean);
    let html = `<div class="checkbox-options" data-field-idx="${fieldArray.indexOf(field)}">`;
    field.options.forEach(opt => {
      const active = selectedValues.includes(opt) ? 'active' : '';
      html += `<label class="checkbox-pill ${active}" data-value="${escapeHtml(opt)}"><span class="check-icon"></span>${escapeHtml(opt)}</label>`;
    });
    html += '</div>';
    return html;
  }

  function bindCheckboxPills(container) {
    container.querySelectorAll('.checkbox-pill').forEach(pill => {
      pill.addEventListener('click', () => { pill.classList.toggle('active'); });
    });
  }

  function readFieldValuesFromUI(container, fieldArray, inputSelector) {
    container.querySelectorAll(`${inputSelector}, .field-select`).forEach(input => {
      const idx = parseInt(input.dataset.fieldIdx, 10);
      if (!isNaN(idx) && fieldArray[idx]) fieldArray[idx].value = input.value;
    });
    container.querySelectorAll('.checkbox-options').forEach(cont => {
      const idx = parseInt(cont.dataset.fieldIdx, 10);
      if (!isNaN(idx) && fieldArray[idx]) {
        const active = cont.querySelectorAll('.checkbox-pill.active');
        fieldArray[idx].value = Array.from(active).map(p => p.dataset.value).join(', ');
      }
    });
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.classList.remove('show'); }, 2500);
  }

  // ─── Event Bindings ───
  function bindEvents() {
    // Tabs
    tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

    // Smart Fill
    scanBtn.addEventListener('click', scanFormSmart);
    smartFillBtn.addEventListener('click', executeSmartFill);
    learnBtn.addEventListener('click', learnFromCurrent);

    // Knowledge Base & Settings
    testApiBtn.addEventListener('click', async () => {
      const key = apiKeyInput.value.trim();
      if (!key) return showToast('Enter API key first', 'error');
      testApiBtn.textContent = '...';
      testApiBtn.disabled = true;
      const valid = await AI.testApiKey(key);
      if (valid) {
        await Knowledge.saveApiKey(key);
        showToast('API Key valid & saved!', 'success');
        noApiWarning.style.display = 'none';
      } else {
        showToast('Invalid API Key', 'error');
      }
      testApiBtn.textContent = 'Test';
      testApiBtn.disabled = false;
    });

    apiKeyInput.addEventListener('change', async () => {
      await Knowledge.saveApiKey(apiKeyInput.value.trim());
      noApiWarning.style.display = apiKeyInput.value.trim() ? 'none' : 'flex';
    });

    saveKbBtn.addEventListener('click', saveKnowledgeBaseUI);

    addCustomBtn.addEventListener('click', () => {
      customFieldModal.style.display = 'flex';
      customFieldName.value = '';
      customFieldValue.value = '';
      customFieldName.focus();
    });

    cancelCustomField.addEventListener('click', () => customFieldModal.style.display = 'none');
    confirmCustomField.addEventListener('click', async () => {
      const name = customFieldName.value.trim();
      const val = customFieldValue.value.trim();
      if (name) {
        // Snake case key
        const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (key) {
          await Knowledge.addCustomField(key, val);
          const kb = await Knowledge.getKnowledgeBase();
          renderCustomFields(kb.custom);
          customFieldModal.style.display = 'none';
        }
      }
    });

    clearMappingsBtn.addEventListener('click', async () => {
      if (confirm('Clear all learned field mappings? This cannot be undone.')) {
        await Knowledge.saveFieldMappings({});
        await updateStats();
        showToast('Learned mappings cleared');
      }
    });

    // Legacy Profiles
    profileSelect.addEventListener('change', async (e) => {
      activeProfileId = e.target.value || null;
      await chrome.storage.local.set({ activeProfileId });
      if (activeProfileId) {
        const prof = profiles.find(p => p.id === activeProfileId);
        profileFields = prof ? prof.fields.map(f => ({...f})) : [];
        fillBtn.disabled = false;
        saveProfileBtn.disabled = false;
      } else {
        profileFields = [];
        fillBtn.disabled = true;
        saveProfileBtn.disabled = true;
      }
      renderProfileFields();
    });

    newProfileBtn.addEventListener('click', () => {
      newProfileModal.style.display = 'flex';
      newProfileName.value = '';
      newProfileName.focus();
    });
    cancelNewProfile.addEventListener('click', () => newProfileModal.style.display = 'none');
    confirmNewProfile.addEventListener('click', async () => {
      const name = newProfileName.value.trim();
      if (name) {
        const profile = { id: 'prof_'+Date.now(), name, fields: [] };
        profiles.push(profile);
        activeProfileId = profile.id;
        await chrome.storage.local.set({ profiles, activeProfileId });
        renderProfileSelect();
        newProfileModal.style.display = 'none';
      }
    });

    deleteProfileBtn.addEventListener('click', async () => {
      if (!activeProfileId) return showToast('Select profile', 'error');
      if (confirm('Delete profile?')) {
        profiles = profiles.filter(p => p.id !== activeProfileId);
        activeProfileId = null;
        profileFields = [];
        await chrome.storage.local.set({ profiles, activeProfileId });
        renderProfileSelect();
        renderProfileFields();
        fillBtn.disabled = true;
        saveProfileBtn.disabled = true;
      }
    });

    saveProfileBtn.addEventListener('click', async () => {
      if (!activeProfileId) return;
      readFieldValuesFromUI(profileFieldsList, profileFields, '.prof-input');
      const p = profiles.find(p => p.id === activeProfileId);
      if (p) p.fields = profileFields.map(f => ({...f}));
      await chrome.storage.local.set({ profiles });
      showToast('Profile saved', 'success');
    });

    fillBtn.addEventListener('click', executeLegacyFill);
  }

  // ─── Start ───
  init();
})();
