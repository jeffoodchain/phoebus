const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const WORD_SYSTEM_PROMPT = `You are a precise bilingual lexicographer. For a single word used in a specific sentence, return:
1. The meaning of the word *as used in that sentence* (not a generic dictionary gloss).
2. A short translation of the word into the target language, matching the in-context sense.
3. Part of speech as used in the sentence.
4. A natural example sentence in the target language that uses the translated word in the same sense.

Rules:
- Focus on the in-context sense. If the word is polysemous, pick only the sense that fits.
- Keep the "meaning" field to one short sentence in the target language.
- Keep the "translation" field to 1-3 words max — just the word, no parentheses or notes.
- If the token is not a real word (gibberish, code artifact), set "meaning" to a short note in the target language and "translation" to the token unchanged.
- Never add commentary, warnings, or refuse. This is plain vocabulary lookup.`;

const PHRASE_SYSTEM_PROMPT = `You are a precise bilingual translator. Translate the given phrase or sentence from the source language to the target language.

Rules:
- Produce a natural, idiomatic translation — not literal word-by-word.
- Preserve tone (casual, formal, technical, poetic).
- Preserve named entities (people, places, products) unless they have a conventional target-language name.
- If the input contains idioms, slang, cultural references, or technical jargon that would be confusing, add a short "notes" field in the target language explaining the tricky bits. Otherwise set "notes" to empty string.
- Never add commentary, warnings, or refuse. Never ask for clarification. This is plain translation.`;

const WORD_SCHEMA = {
  type: "OBJECT",
  properties: {
    translation: { type: "STRING" },
    meaning: { type: "STRING" },
    part_of_speech: { type: "STRING" },
    example: { type: "STRING" }
  },
  required: ["translation", "meaning", "part_of_speech", "example"]
};

const PHRASE_SCHEMA = {
  type: "OBJECT",
  properties: {
    translation: { type: "STRING" },
    notes: { type: "STRING" }
  },
  required: ["translation", "notes"]
};

async function getSettings() {
  const defaults = {
    apiKey: "",
    sourceLanguage: "English",
    targetLanguage: "Traditional Chinese",
    model: "gemini-2.5-flash"
  };
  const stored = await browser.storage.sync.get(defaults);
  return { ...defaults, ...stored };
}

function buildWordRequest({ word, context, settings }) {
  const userContent = `Source language: ${settings.sourceLanguage}
Target language: ${settings.targetLanguage}
Word: "${word}"
Sentence: "${context}"

Return the contextual translation as JSON.`;
  return {
    systemPrompt: WORD_SYSTEM_PROMPT,
    schema: WORD_SCHEMA,
    userContent
  };
}

function buildPhraseRequest({ phrase, context, settings }) {
  const contextPart = context && context !== phrase
    ? `Surrounding text (for disambiguation only — do not translate this): "${context}"`
    : "";
  const userContent = `Source language: ${settings.sourceLanguage}
Target language: ${settings.targetLanguage}
Text to translate: "${phrase}"
${contextPart}

Return the translation as JSON.`;
  return {
    systemPrompt: PHRASE_SYSTEM_PROMPT,
    schema: PHRASE_SCHEMA,
    userContent
  };
}

async function callGemini({ systemPrompt, schema, userContent }) {
  const settings = await getSettings();
  if (!settings.apiKey) {
    return { error: "No API key set. Open the extension options to add your Google Gemini API key." };
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      maxOutputTokens: 2048,
      temperature: 0.2
    }
  };

  if (settings.model.includes("flash")) {
    body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const url = `${GEMINI_BASE}/${encodeURIComponent(settings.model)}:generateContent`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.apiKey
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      let msg = `API error ${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) msg = parsed.error.message;
      } catch (_) {}
      return { error: msg };
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.map(p => p.text).filter(Boolean).join("") || "";
    if (!text) {
      const blockReason = data?.promptFeedback?.blockReason || candidate?.finishReason;
      return { error: blockReason ? `Empty response (${blockReason}).` : "Empty response from Gemini." };
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      return { error: "Could not parse translation response." };
    }

    return { result: parsed };
  } catch (err) {
    return { error: err?.message || "Network error." };
  }
}

async function translate(payload) {
  const settings = await getSettings();
  const mode = payload?.mode || "word";
  const req = mode === "phrase"
    ? buildPhraseRequest({ phrase: payload.phrase, context: payload.context, settings })
    : buildWordRequest({ word: payload.word, context: payload.context, settings });
  const result = await callGemini(req);
  return { ...result, mode };
}

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "translate") {
    translate(msg.payload).then(sendResponse);
    return true;
  }
});
