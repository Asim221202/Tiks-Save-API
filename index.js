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

app.get("/api/tiktok", async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: "URL is required" });

  const videoId = extractVideoId(videoUrl);
  if (!videoId) return res.status(400).json({ error: "Invalid TikTok URL" });

  try {
    // TikTok feed endpoint (şimdilik public istek)
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

    // Watermark’lı ve watermark’sız URL’leri çöz
    const wmUrl = videoData.video?.play_addr?.url_list?.[0] || null;
    const noWmUrl = videoData.video?.play_addr?.uri
      ? `https://api.tikmate.app/api/lookup/${videoData.video.play_addr.uri}`
      : null;

    const result = {
      id: videoId,
      description: videoData.desc,
      author: videoData.author?.unique_id,
      cover: videoData.video?.cover?.url_list?.[0],
      wmplay: wmUrl,
      nowmplay: noWmUrl, // TikWM gibi watermark’sız link (ileride geliştirilir)
    };

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch TikTok data" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
