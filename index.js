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

// Kısaltılmış linki çözme
async function resolveRedirect(url) {
  const response = await fetch(url, { redirect: "manual" });
  if (response.status === 301 || response.status === 302) {
    return response.headers.get("location");
  }
  return url;
}

app.get("/api/tiktok", async (req, res) => {
  let videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: "URL is required" });

  try {
    // Eğer kısa link geldiyse önce çöz
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
          "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
      },
    });

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
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
