import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// TikTok URL’den video ID çıkarma
function extractVideoId(url) {
  const regex = /\/video\/(\d+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Tüm redirect zincirini çöz (kısaltılmış linkler için)
async function resolveRedirect(url) {
  let currentUrl = url;
  for (let i = 0; i < 5; i++) { // max 5 redirect
    const response = await fetch(currentUrl, { redirect: "manual" });
    if (response.status === 301 || response.status === 302) {
      const loc = response.headers.get("location");
      if (!loc) break;
      currentUrl = loc.startsWith("http") ? loc : `https://www.tiktok.com${loc}`;
    } else {
      break;
    }
  }
  return currentUrl;
}

app.get("/api/tiktok", async (req, res) => {
  let videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: "URL is required" });

  try {
    // Eğer kısa linkse çöz
    if (videoUrl.includes("vt.tiktok.com")) {
      videoUrl = await resolveRedirect(videoUrl);
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) return res.status(400).json({ error: "Invalid TikTok URL" });

    // TikTok feed endpoint
    const apiUrl = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`;

    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "com.ss.android.ugc.trill/290 (Linux; U; Android 11; en_US; Pixel 5 Build/RQ3A.210805.001.A1)",
        "Accept": "application/json",
      },
    });

    const contentType = response.headers.get("content-type");

    // JSON dönmezse debug için hata mesajı ver
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      return res.status(500).json({
        error: "TikTok did not return JSON",
        status: response.status,
        headers: Object.fromEntries(response.headers),
        snippet: text.slice(0, 300) // ilk 300 karakter
      });
    }

    // JSON parse
    const data = await response.json();
    const videoData = data.aweme_list?.[0];
    if (!videoData) return res.status(404).json({ error: "Video not found" });

    const wmUrl = videoData.video?.play_addr?.url_list?.[0] || null;
    const cover = videoData.video?.cover?.url_list?.[0] || null;
    const desc = videoData.desc || "";
    const author = videoData.author?.unique_id || "";

    res.json({
      id: videoId,
      description: desc,
      author: author,
      cover: cover,
      wmplay: wmUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch TikTok data" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
