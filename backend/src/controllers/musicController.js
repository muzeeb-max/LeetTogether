import axios from 'axios';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export const searchYouTube = async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ message: 'Search query is required' });
  }

  if (!YOUTUBE_API_KEY) {
    return res.status(500).json({ message: 'YouTube API key is not configured' });
  }

  try {
    console.log("YOUTUBE KEY EXISTS:", !!YOUTUBE_API_KEY);
    console.log("Searching for:", q);

    const response = await axios.get(
      "https://www.googleapis.com/youtube/v3/search",
      {
        params: {
          part: "snippet",
          q,
          type: "video",
          maxResults: 10,
          key: YOUTUBE_API_KEY,
        },
      }
    );

    console.log("FULL YOUTUBE RESPONSE:");
    console.log(JSON.stringify(response.data, null, 2));

    const videos = response.data.items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail:
        item.snippet.thumbnails.default?.url ||
        item.snippet.thumbnails.medium?.url,
    }));

    console.log("VIDEOS:", videos.length);

    return res.json({ videos });
  } catch (err) {
    console.error("YOUTUBE ERROR:");
    console.error(err.response?.data || err.message);

    return res.status(500).json(err.response?.data || { error: err.message });
  }
};
