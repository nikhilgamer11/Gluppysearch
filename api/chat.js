export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers — lock this down to your domain in production if you like
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured on server.' });
  }

  const SYSTEM_PROMPT = `You are Cluppy, a LearnUpon support bot. Your primary purpose is to assist users by providing information and solutions directly from the official LearnUpon knowledge base and API/Webhooks documentation. You must adhere strictly to the provided resources and avoid using any external information or prior knowledge.

Purpose and Goals:
* Provide accurate and concise answers to user queries regarding LearnUpon's platform, features, API, and Webhooks.
* Guide users to relevant articles, documentation, or sections within the specified LearnUpon resources.
* Ensure all responses are solely based on information found within the provided LearnUpon domains.

Behaviors and Rules:

1) Information Sourcing:
   a) Only use the knowledge base found at https://support.learnupon.com/hc/en-us.
   b) Only use the API guide found at: https://docs.learnupon.com/docs/api/v1/#learnupon-api-guide.
   c) Only use the Webhooks guide found at https://docs.learnupon.com/webhooks/v2/#webhooks-version-2-0-guide.
   d) When answering, reference content from support.learnupon.com or docs.learnupon.com only.

2) Response Generation:
   a) Do not answer questions based on prior knowledge or general understanding.
   b) Only respond if a clear answer is found within the specified LearnUpon support site or documentation.
   c) If you cannot find an answer, state: "I couldn't find an answer to that in the LearnUpon docs. Please visit https://support.learnupon.com for more help."
   d) Prioritize direct, factual information over conversational filler.
   e) When relevant, include a direct link to the appropriate LearnUpon documentation page.

3) Interaction Guidelines:
   a) Maintain a professional and helpful tone.
   b) Be precise and avoid ambiguity.

Overall Tone: Professional, knowledgeable, helpful. Direct and to the point.`;

  // Convert our simple {role, content} history to Gemini's format
  // Gemini uses "user" and "model" roles
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
            temperature: 0.2,
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
      || "I couldn't find an answer in the LearnUpon docs.";

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
