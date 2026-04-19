// FormFill Pro — Gemini AI Integration

const AI = (() => {
  'use strict';

  const MODEL = 'gemini-2.5-flash';
  const API_URL = (key) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

  // Cache AI responses to avoid redundant calls
  const responseCache = new Map();

  /**
   * Classify form fields using Gemini AI.
   * Sends only question labels — never user data.
   *
   * @param {Array} questions - [{label, type, options}]
   * @param {Array} availableFields - [{mapping, label, category}]
   * @param {string} apiKey
   * @returns {Array} [{question, mapping, confidence}]
   */
  async function classifyFields(questions, availableFields, apiKey) {
    if (!apiKey) throw new Error('Gemini API key is required');
    if (!questions.length) return [];

    // Build cache key from question labels
    const cacheKey = questions.map(q => q.label).sort().join('|');
    if (responseCache.has(cacheKey)) {
      return responseCache.get(cacheKey);
    }

    const fieldList = availableFields
      .map(f => `  - ${f.mapping} (${f.label})`)
      .join('\n');

    const questionList = questions
      .map((q, i) => {
        let desc = `${i + 1}. "${q.label}" [type: ${q.type}]`;
        if (q.options && q.options.length > 0) {
          desc += ` options: [${q.options.join(', ')}]`;
        }
        return desc;
      })
      .join('\n');

    const prompt = `You are a form field classifier. Given a list of personal data fields and a list of form questions, map each question to the most appropriate data field.

Available personal data fields:
${fieldList}

Form questions to classify:
${questionList}

Rules:
- Map each question to exactly one field from the available list above
- If a question asks for something not in the list, map it to "custom.{descriptive_key}" (use snake_case)
- For multiple-choice/checkbox questions about preferences or opinions (not personal data), map to "custom.{descriptive_key}"
- "confidence" is 0.0 to 1.0 — how confident you are in the mapping
- If the question is a rating, opinion, or feedback that doesn't map to personal data, still use "custom.{key}" with lower confidence

Return ONLY valid JSON array, no markdown, no explanation:
[{"question": "exact question text", "mapping": "category.field", "confidence": 0.95}]`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    };

    try {
      const response = await fetch(API_URL(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error('Rate limit reached. Please wait a moment and try again.');
        }
        throw new Error(err.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error('Empty response from AI');

      // Parse JSON response (handle possible markdown wrapping)
      let results;
      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        results = JSON.parse(cleaned);
      } catch (e) {
        throw new Error('Failed to parse AI response');
      }

      if (!Array.isArray(results)) throw new Error('AI response is not an array');

      // Normalize results
      const normalized = results.map(r => ({
        question: r.question || '',
        mapping: r.mapping || 'custom.unknown',
        confidence: Math.min(1, Math.max(0, r.confidence || 0.5)),
        source: 'ai'
      }));

      // Cache the result
      responseCache.set(cacheKey, normalized);

      return normalized;
    } catch (err) {
      console.error('[FormFill Pro] AI classification error:', err);
      throw err;
    }
  }

  /**
   * Test if the API key is valid
   */
  async function testApiKey(apiKey) {
    try {
      const response = await fetch(API_URL(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with: OK' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Smart resolve: check learned mappings first, then use AI for unknowns.
   *
   * @param {Array} fields - scanned form fields [{label, type, options, ...}]
   * @param {string} apiKey
   * @returns {Array} fields with mapping and resolved value added
   */
  async function smartResolve(fields, apiKey) {
    const availableFields = await Knowledge.getAvailableFields();
    const resolved = [];
    const needsAI = [];

    // Step 1: Check learned mappings
    for (const field of fields) {
      const learned = await Knowledge.lookupMapping(field.label);
      if (learned && learned.confidence >= 0.8) {
        const value = await Knowledge.resolveValue(`${learned.category}.${learned.field}`);
        resolved.push({
          ...field,
          mapping: `${learned.category}.${learned.field}`,
          value: value || field.value || '',
          confidence: learned.confidence,
          source: learned.source
        });
      } else {
        needsAI.push(field);
      }
    }

    // Step 2: Classify remaining fields with AI
    if (needsAI.length > 0) {
      try {
        const aiResults = await classifyFields(needsAI, availableFields, apiKey);

        for (const field of needsAI) {
          const aiMatch = aiResults.find(r =>
            r.question.toLowerCase().trim() === field.label.toLowerCase().trim()
          );

          if (aiMatch) {
            const value = await Knowledge.resolveValue(aiMatch.mapping);
            resolved.push({
              ...field,
              mapping: aiMatch.mapping,
              value: value || field.value || '',
              confidence: aiMatch.confidence,
              source: 'ai'
            });
          } else {
            // No AI match — keep field unresolved
            resolved.push({
              ...field,
              mapping: null,
              value: field.value || '',
              confidence: 0,
              source: 'none'
            });
          }
        }
      } catch (err) {
        // AI failed — add unresolved
        for (const field of needsAI) {
          resolved.push({
            ...field,
            mapping: null,
            value: field.value || '',
            confidence: 0,
            source: 'error',
            error: err.message
          });
        }
      }
    }

    // Preserve original field order
    return fields.map(f => resolved.find(r => r.label === f.label && r.index === f.index) || f);
  }

  // ─── Public API ───
  return {
    classifyFields,
    testApiKey,
    smartResolve
  };
})();

if (typeof window !== 'undefined') {
  window.AI = AI;
}
