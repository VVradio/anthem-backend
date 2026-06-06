// Simple email sending via Resend (https://resend.com — free tier, easy setup).
// Set RESEND_API_KEY and FROM_EMAIL in the environment to turn this on.
// If no key is set, emails are skipped silently (so nothing breaks).

const FROM = process.env.FROM_EMAIL || "Anthem <onboarding@resend.dev>";

export async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) return { skipped: true };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("Email send failed:", t);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("Email error:", e);
    return { ok: false };
  }
}

const SITE = process.env.CLIENT_ORIGIN || "https://www.varietyvibesradio.shop";

export function welcomeEmail(email) {
  return {
    subject: "Welcome to Anthem — your AI music team is ready 🎶",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1f1a16">
        <h2 style="color:#c2542d">Welcome to Anthem!</h2>
        <p>Your AI music team is ready. You've got <b>2 days of full access</b> to all 8 agents —
        Nora (A&R), Mia (social), Iris (cover art), and more.</p>
        <p>Start by filling in your <b>Artist Profile</b> so every agent personalizes its work to you.</p>
        <p><a href="${SITE}" style="display:inline-block;background:#c2542d;color:#fff;
          text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Open your studio</a></p>
        <p style="color:#6b6258;font-size:13px">— The Anthem team</p>
      </div>`,
  };
}

export function trialEndingEmail(email) {
  return {
    subject: "Your Anthem trial ends tomorrow ⏳",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1f1a16">
        <h2 style="color:#c2542d">Your free trial ends tomorrow</h2>
        <p>Don't lose access to your AI music team. Pick a plan to keep working with your agents,
        your Brain, and everything you've saved.</p>
        <p>Plans start at just <b>$29/month</b>.</p>
        <p><a href="${SITE}" style="display:inline-block;background:#c2542d;color:#fff;
          text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Choose your plan</a></p>
        <p style="color:#6b6258;font-size:13px">— The Anthem team</p>
      </div>`,
  };
}
