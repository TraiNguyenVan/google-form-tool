// FormFill Pro — Knowledge Base & Learning Engine

const Knowledge = (() => {
  'use strict';

  // ─── Default Knowledge Base Structure ───
  const DEFAULT_KB = {
    identity: {
      full_name: '', first_name: '', last_name: '', nickname: ''
    },
    contact: {
      email: '', phone: '', alt_email: ''
    },
    address: {
      street: '', city: '', state: '', zip: '', country: ''
    },
    education: {
      school: '', degree: '', major: '', graduation_year: ''
    },
    work: {
      company: '', job_title: '', department: '', years_experience: ''
    },
    personal: {
      birthday: '', gender: '', age: '', nationality: ''
    },
    custom: {}
  };

  // ─── Human-readable labels for categories ───
  const CATEGORY_LABELS = {
    identity: 'Identity',
    contact: 'Contact',
    address: 'Address',
    education: 'Education',
    work: 'Work',
    personal: 'Personal',
    custom: 'Custom'
  };

  const FIELD_LABELS = {
    full_name: 'Full Name', first_name: 'First Name', last_name: 'Last Name',
    nickname: 'Nickname', email: 'Email', phone: 'Phone', alt_email: 'Alt Email',
    street: 'Street', city: 'City', state: 'State', zip: 'ZIP Code',
    country: 'Country', school: 'School', degree: 'Degree', major: 'Major',
    graduation_year: 'Graduation Year', company: 'Company', job_title: 'Job Title',
    department: 'Department', years_experience: 'Years Experience',
    birthday: 'Birthday', gender: 'Gender', age: 'Age', nationality: 'Nationality'
  };

  // ─── Storage Operations ───

  async function getKnowledgeBase() {
    const data = await chrome.storage.local.get('knowledgeBase');
    return data.knowledgeBase || structuredClone(DEFAULT_KB);
  }

  async function saveKnowledgeBase(kb) {
    await chrome.storage.local.set({ knowledgeBase: kb });
  }

  async function getFieldMappings() {
    const data = await chrome.storage.local.get('fieldMappings');
    return data.fieldMappings || {};
  }

  async function saveFieldMappings(mappings) {
    await chrome.storage.local.set({ fieldMappings: mappings });
  }

  async function getApiKey() {
    const data = await chrome.storage.local.get('geminiApiKey');
    return data.geminiApiKey || '';
  }

  async function saveApiKey(key) {
    await chrome.storage.local.set({ geminiApiKey: key });
  }

  // ─── Learning Engine ───

  /**
   * Normalize question text for consistent matching
   */
  function normalizeQuestion(text) {
    return (text || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[*:?\u200B]/g, '') // Remove asterisks, colons, zero-width spaces
      .replace(/^\d+\.\s*/, '');    // Remove leading numbering
  }

  /**
   * Look up a question in learned field mappings.
   * Returns { category, field, confidence } or null.
   */
  async function lookupMapping(questionText) {
    const mappings = await getFieldMappings();
    const normalized = normalizeQuestion(questionText);

    // Exact match
    if (mappings[normalized]) {
      return { ...mappings[normalized], confidence: 1.0, source: 'learned' };
    }

    // Check if any stored mapping is a substring match
    for (const [storedQ, mapping] of Object.entries(mappings)) {
      if (normalized.includes(storedQ) || storedQ.includes(normalized)) {
        return { ...mapping, confidence: 0.85, source: 'learned_partial' };
      }
    }

    return null;
  }

  /**
   * Learn from a completed fill — store question → category.field mappings
   */
  async function learnFromFill(resolvedFields) {
    const mappings = await getFieldMappings();
    const kb = await getKnowledgeBase();
    let newMappings = 0;
    let kbUpdated = false;

    for (const field of resolvedFields) {
      if (field.mapping && field.value) {
        const normalized = normalizeQuestion(field.label);
        const cat = field.mapping.split('.')[0];
        const key = field.mapping.split('.')[1] || field.mapping;

        // 1. Save Mapping
        if (!mappings[normalized]) {
          newMappings++;
        }
        mappings[normalized] = {
          category: cat,
          field: key,
          lastUsed: new Date().toISOString()
        };

        // 2. Save Value to Knowledge Base if missing
        if (cat && key && kb[cat]) {
          if (!kb[cat][key] || (cat === 'custom' && kb[cat][key] !== field.value)) {
            kb[cat][key] = field.value;
            kbUpdated = true;
          }
        } else if (cat === 'custom' && !kb.custom[key]) {
          kb.custom[key] = field.value;
          kbUpdated = true;
        }
      }
    }

    await saveFieldMappings(mappings);
    if (kbUpdated) {
      await saveKnowledgeBase(kb);
    }
    return newMappings;
  }

  /**
   * Resolve a value from the knowledge base given a mapping like "identity.full_name"
   */
  async function resolveValue(mappingStr) {
    const kb = await getKnowledgeBase();
    const [category, field] = (mappingStr || '').split('.');
    if (!category || !field) return '';
    return kb[category]?.[field] || '';
  }

  /**
   * Add a custom field to the knowledge base
   */
  async function addCustomField(key, value) {
    const kb = await getKnowledgeBase();
    kb.custom[key] = value;
    await saveKnowledgeBase(kb);
  }

  /**
   * Get all available fields as a flat list for the AI prompt
   */
  async function getAvailableFields() {
    const kb = await getKnowledgeBase();
    const fields = [];
    for (const [cat, entries] of Object.entries(kb)) {
      for (const [field, value] of Object.entries(entries)) {
        fields.push({
          mapping: `${cat}.${field}`,
          label: FIELD_LABELS[field] || field,
          category: CATEGORY_LABELS[cat] || cat,
          hasValue: !!value
        });
      }
    }
    return fields;
  }

  /**
   * Get stats about the learning engine
   */
  async function getStats() {
    const mappings = await getFieldMappings();
    const kb = await getKnowledgeBase();
    let filledFields = 0;
    let totalFields = 0;

    for (const entries of Object.values(kb)) {
      for (const value of Object.values(entries)) {
        totalFields++;
        if (value) filledFields++;
      }
    }

    return {
      learnedMappings: Object.keys(mappings).length,
      filledFields,
      totalFields
    };
  }

  // ─── Public API ───
  return {
    DEFAULT_KB, CATEGORY_LABELS, FIELD_LABELS,
    getKnowledgeBase, saveKnowledgeBase,
    getFieldMappings, saveFieldMappings,
    getApiKey, saveApiKey,
    normalizeQuestion, lookupMapping,
    learnFromFill, resolveValue,
    addCustomField, getAvailableFields, getStats
  };
})();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.Knowledge = Knowledge;
}
