import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ----------------------------------------------------------------------------
// STREAMING ANALYTICS
//
// Returns a user's streaming stats. Right now it serves SAMPLE data so the
// dashboard works end-to-end. To show REAL numbers you connect the artist's
// Spotify / Apple accounts via OAuth (stubs below) and replace getSampleStats()
// with calls to those APIs, caching results in your database.
//
// Reality check on access:
// - Spotify: artist dashboard stats come through Spotify for Artists / their
//   analytics partner program, not the open Web API. You apply for access.
// - Apple Music: uses Apple's MusicKit / Analytics with a developer token.
// Both require approval, so build against sample data until you're approved.
// ----------------------------------------------------------------------------

function getSampleStats() {
  return {
    sample: true,
    months: ["Dec", "Jan", "Feb", "Mar", "Apr", "May"],
    streams: [18200, 21400, 19800, 28600, 34100, 42800],
    monthlyListeners: 42800,
    topTracks: [
      { title: "Wildfire", streams: 184200 },
      { title: "Slow Burn", streams: 121800 },
      { title: "Coastline", streams: 98400 },
      { title: "Paper Hearts", streams: 64100 },
      { title: "Lantern", streams: 41900 },
    ],
    platforms: [
      { name: "Spotify", pct: 58 },
      { name: "Apple Music", pct: 24 },
      { name: "YouTube Music", pct: 11 },
      { name: "Other", pct: 7 },
    ],
  };
}

// GET /api/streams — stats for the logged-in artist.
router.get("/", requireAuth, (_req, res) => {
  // TODO: if the user has connected accounts, fetch + merge real data here.
  res.json(getSampleStats());
});

// ---- OAuth connect stubs ----
// Step 1: redirect the artist to the provider's consent screen.
// Step 2: provider redirects back to /callback with a code; you exchange it for
// tokens, store them against the user, and start pulling their stats.
router.get("/connect/spotify", requireAuth, (_req, res) => {
  // const url = `https://accounts.spotify.com/authorize?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${...}&scope=user-read-private`;
  // return res.json({ url });
  res.status(501).json({ error: "Spotify connect not configured. Add SPOTIFY_CLIENT_ID and build the OAuth flow." });
});

router.get("/connect/apple", requireAuth, (_req, res) => {
  res.status(501).json({ error: "Apple Music connect not configured. Add Apple developer token and MusicKit flow." });
});

router.get("/connect/youtube", requireAuth, (_req, res) => {
  // YouTube Music data comes via the YouTube Data API / YouTube Analytics API (Google OAuth).
  res.status(501).json({ error: "YouTube connect not configured. Add Google OAuth (YouTube Data/Analytics API)." });
});

router.get("/connect/other", requireAuth, (req, res) => {
  // Catch-all for Tidal, Deezer, Amazon Music, etc. Many artists use a distributor
  // (DistroKid, TuneCore, CD Baby) whose API aggregates these — often the easiest path.
  res.status(501).json({ error: "Other platforms not configured. Consider connecting a distributor (DistroKid/TuneCore) that aggregates them." });
});

router.get("/callback/:provider", (req, res) => {
  // const { code } = req.query; exchange for tokens, save to DB against the user.
  res.status(501).send(`OAuth callback for ${req.params.provider} not implemented yet.`);
});

export default router;
