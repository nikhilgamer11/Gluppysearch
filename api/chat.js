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
  const SEARCH_KEY = process.env.GOOGLE_SEARCH_API_KEY;
  const SEARCH_CX  = process.env.GOOGLE_SEARCH_CX;

  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured.' });
  if (!SEARCH_KEY) return res.status(500).json({ error: 'GOOGLE_SEARCH_API_KEY not configured.' });
  if (!SEARCH_CX)  return res.status(500).json({ error: 'GOOGLE_SEARCH_CX not configured.' });

  // Step 1: Get the latest user question
  const userQuestion = messages[messages.length - 1]?.content || '';

  // Step 2: Search the real LearnUpon KB via Google Custom Search
  let searchContext = '';
  let searchResults = [];

  try {
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${SEARCH_KEY}&cx=${SEARCH_CX}&q=${encodeURIComponent(userQuestion)}&num=5`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (searchData.items && searchData.items.length > 0) {
      searchResults = searchData.items.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet
      }));

      searchContext = `
Here are REAL articles found in the LearnUpon knowledge base for this question:

${searchResults.map((r, i) => `[${i + 1}] Title: ${r.title}
URL: ${r.link}
Summary: ${r.snippet}`).join('\n\n')}

IMPORTANT: Only use the exact URLs listed above. Never guess or generate URLs.
`;
    } else {
      searchContext = `No specific articles were found. Answer based on your LearnUpon knowledge but do not include any article links.`;
    }
  } catch (err) {
    searchContext = `Search unavailable. Answer based on your LearnUpon knowledge but do not include any article links.`;
  }

  // Step 3: Build the system prompt with real search results injected
  const SYSTEM_PROMPT = `You are Cluppy, a LearnUpon support bot. You answer questions strictly based on the official LearnUpon knowledge base.

${searchContext}

Rules:
1. Answer ONLY using the information and URLs from the search results above.
2. NEVER generate, guess, or make up article URLs. Only use the exact URLs provided above.
3. If no search results were found, say: "I couldn't find a specific article for this. Please search at https://support.learnupon.com/hc/en-us"
4. Always be accurate, concise, and professional.
5. Always end your response with a "📋 Next Steps" section with 2-3 actionable suggestions.

Response format:
- Direct answer to the question
- Step-by-step instructions if applicable
- 🔗 Reference: [exact URL from search results only]
- 📋 Next Steps: 2-3 actionable suggestions the user might want to do next`;

  // Step 4: Call Gemini with the enriched context
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
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: geminiContents,
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.1,
          }
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const errMsg = data?.error?.message || `Gemini error ${geminiRes.status}`;
      return res.status(502).json({ error: errMsg });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
      || "I couldn't find an answer in the LearnUpon docs. Please visit https://support.learnupon.com/hc/en-us";

    return res.status(200).json({ reply, sources: searchResults });

  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
