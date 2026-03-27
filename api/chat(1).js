export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured.' });

  // Step 1: Get the latest user question
  const userQuestion = messages[messages.length - 1]?.content || '';

  // Step 2: Search the real LearnUpon KB via Zendesk API (no key needed!)
  let searchContext = '';
  try {
    const encoded = encodeURIComponent(userQuestion);
    const searchRes = await fetch(
      `https://support.learnupon.com/api/v2/help_center/articles/search.json?query=${encoded}&per_page=5`
    );
    const searchData = await searchRes.json();

    if (searchData.results && searchData.results.length > 0) {
      const articles = searchData.results.slice(0, 5).map((a, i) =>
        `[${i + 1}] Title: ${a.title}\nURL: ${a.html_url}\nSummary: ${a.snippet?.replace(/<[^>]*>/g, '') || ''}`
      ).join('\n\n');

      searchContext = `Here are REAL articles found in the LearnUpon knowledge base:\n\n${articles}\n\nIMPORTANT: Only use the exact URLs listed above. Never guess or generate URLs.`;
    } else {
      searchContext = `No specific articles found. Answer based on LearnUpon knowledge but do not include any article links.`;
    }
  } catch (err) {
    searchContext = `Search unavailable. Answer based on LearnUpon knowledge but do not include any article links.`;
  }

  // Step 3: Build system prompt with real results
  const SYSTEM_PROMPT = `You are Cluppy, a LearnUpon support bot.

${searchContext}

Rules:
1. Answer using the information and URLs from the search results above.
2. NEVER guess or make up article URLs. Only use exact URLs from the search results.
3. If no results were found, direct users to https://support.learnupon.com/hc/en-us
4. Be accurate, concise, and professional.
5. Always end with a "📋 Next Steps" section with 2-3 actionable suggestions.

Response format:
- Direct answer to the question
- Step-by-step instructions if applicable
- 🔗 Reference: [exact URL from search results only]
- 📋 Next Steps: 2-3 actionable suggestions`;

  // Step 4: Call Gemini
  const geminiContents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: geminiContents,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.1 }
        })
      }
    );

    const data = await geminiRes.json();
    if (!geminiRes.ok) return res.status(502).json({ error: data?.error?.message || 'Gemini error' });

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
      || "I couldn't find an answer. Please visit https://support.learnupon.com/hc/en-us";

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
