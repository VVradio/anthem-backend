// lib/platformConfig.js
// Ported from the frontend artifact's PLATFORM_CONFIG.
// Keep this in sync if you change platform rules on the frontend.

const PLATFORM_CONFIG = {
  Instagram: {
    contentTypes: ["Caption", "Story Ideas", "Hashtags"],
    formatNote:
      "Captions can be longer with line breaks; first line is the hook before 'more'. Stories are vertical full-screen slides.",
    hashtagCounts: { niche: 5, mid: 5, broad: 5 },
    hashtagNote: "Instagram rewards heavy hashtag use, 15-30 total is normal.",
    postTypes: ["Caption", "Story", "Reel", "Image Post"],
  },
  Facebook: {
    contentTypes: ["Caption", "Story Ideas", "Hashtags"],
    formatNote:
      "Captions can be conversational and slightly longer; hashtags matter less than on Instagram. Good for community-building tone.",
    hashtagCounts: { niche: 3, mid: 2, broad: 0 },
    hashtagNote: "Facebook hashtags barely affect reach — keep it light, 2-5 total max.",
    postTypes: ["Caption", "Story", "Reel", "Image Post"],
  },
  TikTok: {
    contentTypes: ["Caption", "Video Hooks", "Hashtags"],
    formatNote:
      "Captions are short and punchy with strong hooks. Trends, sounds, and authenticity matter more than polish.",
    hashtagCounts: { niche: 4, mid: 3, broad: 2 },
    hashtagNote:
      "TikTok favors a heavier mix of niche + a couple of broad/trending tags (like #fyp style), 5-9 total.",
    postTypes: ["Video", "Duet/Stitch", "Live"],
  },
  X: {
    contentTypes: ["Caption", "Thread Ideas", "Hashtags"],
    formatNote:
      "Posts are short (under 280 characters per post when possible), punchy, conversational, often witty or opinionated. Threads break ideas into numbered short posts.",
    hashtagCounts: { niche: 1, mid: 1, broad: 0 },
    hashtagNote:
      "X performance drops with too many hashtags — near-zero use, 0-2 total max, often none at all.",
    postTypes: ["Post", "Thread", "Reply"],
  },
  LinkedIn: {
    contentTypes: ["Caption", "Story Ideas", "Hashtags"],
    formatNote:
      "Professional tone, can be longer-form with line breaks, often shares insights, lessons, or behind-the-business stories. Minimal slang/emoji, light hashtag use (3-5 max).",
    hashtagCounts: { niche: 2, mid: 2, broad: 1 },
    hashtagNote:
      "LinkedIn favors a small set of professional/industry hashtags, 3-5 total, placed at the end of the post.",
    postTypes: ["Post", "Article", "Document/Carousel"],
  },
  YouTube: {
    contentTypes: ["Caption", "Video Description", "Hashtags"],
    formatNote:
      "Video descriptions are longer-form with a strong first 1-2 lines (shown before 'more'), include keywords for SEO, and often include timestamps or links. Titles should be clickable and curiosity-driven.",
    hashtagCounts: { niche: 3, mid: 2, broad: 1 },
    hashtagNote:
      "YouTube shows the first 3 hashtags above the title — keep total to 3-5, SEO/keyword-driven rather than trendy.",
    postTypes: ["Video", "Short", "Community Post"],
  },
};

const VALID_PLATFORMS = Object.keys(PLATFORM_CONFIG);

function getPlatformConfig(platform) {
  return PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.Instagram;
}

function buildBrandBlock({ brandName, brandHistory, brandVoice, customVoice, brandValues, platform }) {
  const effectiveVoice = brandVoice === "Custom" ? customVoice : brandVoice;
  return `BRAND PROFILE:
${brandName ? `- Brand name: ${brandName}` : ""}
${brandHistory ? `- Brand story: ${brandHistory}` : ""}
${effectiveVoice ? `- Brand voice: ${effectiveVoice}` : ""}
${brandValues ? `- Core values: ${brandValues}` : ""}
Platform: ${platform}`;
}

module.exports = { PLATFORM_CONFIG, VALID_PLATFORMS, getPlatformConfig, buildBrandBlock };
