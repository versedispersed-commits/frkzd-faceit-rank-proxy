const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

app.get('/rank/:nick', async (req, res) => {
  const { nick } = req.params;
  const output = { rank: 'Error', debug: '' };

  try {
    const response = await axios.get(`https://www.faceit.com/en/players/${nick}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
        'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="129", "Chromium";v="129"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000,
      responseType: 'text'  // Force text to avoid binary issues
    });

    output.debug += `Status: ${response.status} | Content length: ${response.data.length} `;

    const $ = cheerio.load(response.data);
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

    const match = bodyText.match(/North America\s*(\d+)/i);
    if (match && match[1]) {
      output.rank = match[1];
    } else {
      output.debug += '| No match. First 300 chars: ' + bodyText.substring(0, 300);
    }

  } catch (err) {
    output.debug = `Fetch failed: ${err.message}`;
    if (err.response) {
      output.debug += ` | Status: ${err.response.status} | Headers: ${JSON.stringify(err.response.headers)}`;
    }
  }

  res.json(output);  // Always send JSON
});

module.exports = app;
