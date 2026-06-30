import { Router } from "express";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// The embed script and public chat run on arbitrary artist websites, so these
// routes must accept any origin (override the app's global CORS).
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const CLEO_BASE = "You are Cleo, a friendly 24/7 chat assistant embedded on a musician/band's own website. " +
  "Answer fan questions (tour dates, releases, merch, how to follow), handle venue/booking inquiries, and be warm, upbeat, and concise. " +
  "Only answer based on what you know about this artist below. If you don't know something, say so kindly and suggest they reach out, " +
  "and never invent tour dates, prices, or links.";

// GET /api/widget/me — the artist's widget code + custom info (creates a code if needed).
router.get("/me", requireAuth, async (req, res) => {
  let { code, info } = await db.getWidget(req.user.id);
  if (!code) { code = crypto.randomBytes(6).toString("hex"); await db.setWidgetCode(req.user.id, code); }
  res.json({ code, info });
});

// POST /api/widget/info — save the extra info the artist wants Cleo to know.
router.post("/info", requireAuth, async (req, res) => {
  await db.setWidgetInfo(req.user.id, (req.body?.info || "").slice(0, 8000));
  res.json({ ok: true });
});

// GET /api/widget/embed/:code.js — the script the artist pastes into their website.
// Renders a floating chat bubble that talks to the public chat endpoint below.
router.get("/embed/:code.js", async (req, res) => {
  const code = req.params.code;
  const origin = process.env.PUBLIC_API_ORIGIN || `${req.protocol}://${req.get("host")}`;
  res.set("Content-Type", "application/javascript");
  res.send(`(function(){
  var API="${origin}", CODE="${code}", open=false, msgs=[];
  var bubble=document.createElement('div');
  bubble.innerHTML='💬';
  bubble.style.cssText='position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:#c2542d;color:#fff;font-size:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:99999';
  document.body.appendChild(bubble);
  var panel=document.createElement('div');
  panel.style.cssText='position:fixed;bottom:88px;right:20px;width:340px;max-width:92vw;height:460px;max-height:70vh;background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.3);display:none;flex-direction:column;overflow:hidden;z-index:99999;font-family:system-ui,sans-serif';
  panel.innerHTML='<div style="background:#c2542d;color:#fff;padding:14px 16px;font-weight:600">Chat with us</div>'+
    '<div id="aw-msgs" style="flex:1;overflow-y:auto;padding:14px;font-size:14px;line-height:1.5;color:#1f1a16"></div>'+
    '<div style="display:flex;border-top:1px solid #eee"><input id="aw-in" placeholder="Type a message..." style="flex:1;border:none;padding:12px;font-size:14px;outline:none"><button id="aw-send" style="background:#c2542d;color:#fff;border:none;padding:0 16px;cursor:pointer">Send</button></div>';
  document.body.appendChild(panel);
  var box=panel.querySelector('#aw-msgs'), input=panel.querySelector('#aw-in'), send=panel.querySelector('#aw-send');
  function add(role,text){var d=document.createElement('div');d.style.cssText='margin:8px 0;'+(role==='user'?'text-align:right':'');var b=document.createElement('span');b.textContent=text;b.style.cssText='display:inline-block;padding:8px 12px;border-radius:12px;max-width:80%;'+(role==='user'?'background:#c2542d;color:#fff':'background:#f3eee7;color:#1f1a16');d.appendChild(b);box.appendChild(d);box.scrollTop=box.scrollHeight;}
  function toggle(){open=!open;panel.style.display=open?'flex':'none';if(open&&!msgs.length){add('assistant','Hey! 👋 Ask me anything about the music, shows, or merch.');}}
  bubble.onclick=toggle;
  async function ship(){var t=input.value.trim();if(!t)return;input.value='';add('user',t);msgs.push({role:'user',text:t});add('assistant','...');
    try{var r=await fetch(API+'/api/widget/chat/'+CODE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:msgs})});var j=await r.json();box.lastChild.remove();add('assistant',j.reply||'Sorry, try again.');msgs.push({role:'assistant',text:j.reply||''});}
    catch(e){box.lastChild.remove();add('assistant','Connection issue — try again.');}}
  send.onclick=ship;input.addEventListener('keydown',function(e){if(e.key==='Enter')ship();});
})();`);
});

// POST /api/widget/chat/:code — PUBLIC: a fan on the artist's site chats with Cleo.
router.post("/chat/:code", async (req, res) => {
  const artist = await db.findUserByWidgetCode(req.params.code);
  if (!artist) return res.status(404).json({ error: "Unknown widget" });
  const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
  if (!messages.length) return res.status(400).json({ error: "No message" });

  // Build Cleo's knowledge from the artist's Brain + their custom widget info.
  let knowledge = "";
  try {
    const brain = await db.listBrain(artist.id);
    if (brain.length) knowledge += brain.map(b => `• ${b.label || b.kind}: ${b.content}`).join("\n").slice(0, 6000);
  } catch {}
  if (artist.widgetInfo) knowledge += `\n\nArtist-provided info:\n${artist.widgetInfo}`;
  const system = CLEO_BASE + (knowledge ? `\n\nWhat you know about this artist:\n${knowledge}` : "\n\n(No extra info was provided yet.)");

  try {
    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system,
      messages: messages.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text || "" })),
    });
    const reply = result.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    res.json({ reply });
  } catch (e) {
    console.error("Widget chat error:", e?.message || e);
    res.status(502).json({ error: "AI error" });
  }
});

export default router;
