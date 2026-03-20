# 📎 Cluppy — LearnUpon Support Bot (Vercel + Gemini)

Zero-friction AI support bot for LearnUpon. Users just open the URL and chat — no API key prompt, no login.

**Stack:** Static HTML frontend → Vercel Serverless Function → Google Gemini API

---

## 📁 Project structure

```
cluppy/
├── public/
│   └── index.html       ← The chat UI
├── api/
│   └── chat.js          ← Serverless function (hides your Gemini key)
├── vercel.json          ← Vercel routing config
└── README.md
```

---

## 🔑 Step 1 — Get your free Gemini API key

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **"Get API Key"** → **"Create API key"**
3. Copy the key (starts with `AIza...`)

> No billing required. Free tier includes generous usage limits.

---

## 🚀 Step 2 — Deploy to Vercel

### Option A — GitHub (recommended)

1. Push this folder to a new GitHub repo
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repo
4. Vercel will auto-detect the config — click **Deploy**

### Option B — Vercel CLI

```bash
npm i -g vercel
cd cluppy
vercel
```

---

## 🔐 Step 3 — Add your Gemini key as an Environment Variable

This is the critical step that keeps your key secret.

1. In your Vercel project dashboard → **Settings → Environment Variables**
2. Add:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** your key (`AIza...`)
   - **Environment:** Production (and Preview if you want)
3. Click **Save**
4. Go to **Deployments** → **Redeploy** (so the new env var takes effect)

Your key is now stored securely on Vercel's servers — it never touches the browser.

---

## ✅ Done!

Your site is live at `https://your-project.vercel.app`

Share that URL with your team. No setup needed on their end.

---

## ✏️ Customising

| What | Where |
|---|---|
| System prompt / bot rules | `api/chat.js` → `SYSTEM_PROMPT` constant |
| Suggested questions | `public/index.html` → `.sug-btn` buttons |
| Bot name & branding | `public/index.html` → `<header>` section |
| Gemini model | `api/chat.js` → URL (`gemini-1.5-flash` → `gemini-1.5-pro` for higher quality) |

---

## 🛡️ Security notes

- Your Gemini API key is stored as a Vercel env variable — never exposed to the browser
- The `/api/chat` endpoint accepts POST requests with a `messages` array
- To restrict to your domain only, change `Access-Control-Allow-Origin: *` in `api/chat.js` to your Vercel URL

---

Built by the CX team · Powered by Google Gemini
