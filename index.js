const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

app.get('/rank/:nick', async (req, res) => {
  const { nick } = req.params;
  try {
    const { data } = await axios.get(`https://www.faceit.com/en/players/${nick}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProxyBot/1.0)' }
    });
    const $ = cheerio.load(data);
    const bodyText = $('body').text(); // or target specific elements if needed
    const match = bodyText.match(/North America\s*(\d+)/i) || bodyText.match(/NA\s*#?(\d+)/i);
    const rank = match ? match[1] : 'Error';
    res.json({ rank });
  } catch (err) {
    console.error(err);
    res.status(500).json({ rank: 'Error' });
  }
});

// Export for Vercel serverless
module.exports = app;
