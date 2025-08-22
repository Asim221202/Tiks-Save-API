import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

function extractVideoId(url) {
  const regex = /\/video\/(\d+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function resolveRedirect(url) {
  let currentUrl = url;
  for (let i = 0; i < 5; i++) {
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
    if (videoUrl.includes("vt.tiktok.com")) {
      videoUrl = await resolveRedirect(videoUrl);
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) return res.status(400).json({ error: "Invalid TikTok URL" });

    const apiUrl = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`;

    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "com.ss.android.ugc.trill/290 (Linux; U; Android 11; en_US; Pixel 5 Build/RQ3A.210805.001.A1)",
        "Accept": "application/json",
      },
    });

    const raw = await response.text(); // önce ham veriyi al
    let data;

    try {
      data = JSON.parse(raw); // JSON parse etmeyi dene
    } catch {
      return res.status(500).json({
        error: "TikTok did not return valid JSON",
        status: response.status,
        snippet: raw.slice(0, 300) // hata ayıklama için ilk 300 karakter
      });
    }

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
