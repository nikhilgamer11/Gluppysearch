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

  const SYSTEM_PROMPT = `You are Cluppy, a LearnUpon support bot. Answer questions about LearnUpon clearly and accurately.

STRICT RULES:
1. Only link to these two domains: support.learnupon.com or docs.learnupon.com
2. If you are not 100% sure an article URL exists, do NOT include a link. Instead say "Search for this at https://support.learnupon.com/hc/en-us"
3. Never guess or make up URLs.
4. Always end with a "📋 Next Steps" section with 2-3 actionable suggestions.

Response format:
- Direct answer
- Step-by-step instructions if needed
- 🔗 Reference link (only if 100% certain it exists)
- 📋 Next Steps: 2-3 actionable suggestions`;

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
