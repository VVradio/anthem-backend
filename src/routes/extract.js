import { Router } from "express";
import express from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Accept up to ~10MB of base64 file data in JSON.
router.use(express.json({ limit: "12mb" }));

// POST /api/extract  { name, type, dataBase64 }  -> { text }
// Pulls readable text out of a .txt/.md, PDF, or Word doc so an agent can use it.
router.post("/", requireAuth, async (req, res) => {
  const { name = "", type = "", dataBase64 } = req.body || {};
  if (!dataBase64) return res.status(400).json({ error: "No file data" });

  const buffer = Buffer.from(dataBase64, "base64");
  const lower = name.toLowerCase();

  try {
    // Plain text / markdown
    if (type.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md")) {
      return res.json({ text: buffer.toString("utf8").slice(0, 20000) });
    }
    // PDF
    if (type === "application/pdf" || lower.endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      return res.json({ text: (data.text || "").slice(0, 20000) });
    }
    // Word (.docx)
    if (lower.endsWith(".docx") || type.includes("officedocument.wordprocessing")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return res.json({ text: (result.value || "").slice(0, 20000) });
    }
    return res.status(415).json({ error: "Unsupported file type. Use .txt, .md, .pdf, or .docx." });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Couldn't read that file." });
  }
});

export default router;
