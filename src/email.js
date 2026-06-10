// Simple email sending via Resend (https://resend.com — free tier, easy setup).
// Set RESEND_API_KEY and FROM_EMAIL in the environment to turn this on.
// If no key is set, emails are skipped silently (so nothing breaks).

const FROM = process.env.FROM_EMAIL || "Anthem <onboarding@resend.dev>";

export async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    console.log("Email skipped — RESEND_API_KEY not detected by the server.");
    return { skipped: true };
  }
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
    console.log("Email sent to", to);
    return { ok: true };
  } catch (e) {
    console.error("Email error:", e);
    return { ok: false };
  }
}

const SITE = process.env.CLIENT_ORIGIN || "https://www.varietyvibesradio.shop";

// Address that receives owner alerts (new signups, upgrades). Override with OWNER_NOTIFY_EMAIL.
const OWNER_NOTIFY = process.env.OWNER_NOTIFY_EMAIL || "gw@varietyvibesradio.com";

// Send a heads-up to the owner. Fire-and-forget; never blocks the user flow.
export function notifyOwner(kind, details = {}) {
  let subject, lines;
  if (kind === "signup") {
    subject = "🎉 New Anthem signup";
    lines = [`A new artist just signed up.`, `Email: ${details.email || "—"}`];
  } else if (kind === "upgrade") {
    subject = "💰 New Anthem upgrade";
    lines = [`Someone upgraded their plan.`, `Email: ${details.email || "—"}`,
      `Plan: ${details.plan || "—"}`, details.amount ? `Amount: ${details.amount}` : ""];
  } else {
    subject = "Anthem notification";
    lines = [JSON.stringify(details)];
  }
  const html = `<div style="font-family:system-ui,sans-serif;color:#1f1a16;line-height:1.6">
    ${lines.filter(Boolean).map(l => `<p style="margin:4px 0">${l}</p>`).join("")}
    <p style="margin-top:14px"><a href="${SITE}">Open Anthem</a></p></div>`;
  // Don't await — never let an owner alert slow down or break signup/checkout.
  sendEmail(OWNER_NOTIFY, subject, html).catch(() => {});
}

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

export function paymentEmail(email, planName, amountText) {
  return {
    subject: "Payment received — you're all set on Anthem ✅",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1f1a16">
        <h2 style="color:#7b8b6f">Payment received — thank you!</h2>
        <p>Your <b>${planName || "Anthem"}</b> plan is now active${amountText ? ` (${amountText})` : ""}.
        Your AI music team is fully unlocked and ready to go.</p>
        <p><a href="${SITE}" style="display:inline-block;background:#c2542d;color:#fff;
          text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Open your studio</a></p>
        <p style="color:#6b6258;font-size:13px">This email is your receipt. Questions? Just reply.<br>— The Anthem team</p>
      </div>`,
  };
}

export function resetPasswordEmail(email, resetUrl) {
  return {
    subject: "Reset your Anthem password",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1f1a16">
        <h2 style="color:#c2542d">Reset your password</h2>
        <p>We got a request to reset your Anthem password. Click below to choose a new one.
        This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#c2542d;color:#fff;
          text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Reset my password</a></p>
        <p style="color:#6b6258;font-size:13px">Or paste this link: ${resetUrl}<br>— The Anthem team</p>
      </div>`,
  };
}

export function weeklyDigestEmail(email, data) {
  const { bookings = [], tip = "" } = data || {};
  const bookingHtml = bookings.length
    ? `<ul style="padding-left:18px;margin:8px 0">${bookings.map(b => {
        let when = b.startsAt;
        try { when = new Date(b.startsAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch {}
        return `<li style="margin:4px 0"><b>${b.title || "Booking"}</b>${b.withWho ? " with " + b.withWho : ""} — ${when}</li>`;
      }).join("")}</ul>`
    : `<p style="color:#6b6258">No bookings on the calendar yet. Add your next gig or session in the Calendar tab.</p>`;
  return {
    subject: "Your week on Anthem 🎵",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1f1a16">
        <h2 style="color:#c2542d">Your week ahead</h2>
        <h3 style="margin-bottom:4px">📅 Upcoming bookings</h3>
        ${bookingHtml}
        <h3 style="margin-bottom:4px">💡 Tip of the week</h3>
        <p style="color:#1f1a16;line-height:1.5">${tip}</p>
        <p style="margin-top:18px"><a href="${SITE}" style="display:inline-block;background:#c2542d;color:#fff;
          text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Open your studio</a></p>
        <p style="color:#6b6258;font-size:12px;margin-top:20px">You're getting this weekly digest from Anthem. You can turn it off in Settings.</p>
      </div>`,
  };
}
