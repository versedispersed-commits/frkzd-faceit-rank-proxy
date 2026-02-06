const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

app.get('/rank/:nick', async (req, res) => {
  const { nick } = req.params;

  if (!nick || nick.length < 2 || nick.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(nick)) {
    return res.status(400).json({ rank: 'Error', debug: 'Invalid nickname' });
  }

  const output = { rank: 'Error', debug: '' };

  try {
    const response = await axios.get(`https://www.faceit.com/en/players/${nick}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': 'https://www.faceit.com/',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua-platform-version': '"15.0.0"',
        'sec-ch-ua-full-version-list': '"Google Chrome";v="131.0.6778.72", "Chromium";v="131.0.6778.72", "Not_A Brand";v="24.0.0.0"',
        'sec-ch-ua-model': '""',
        'sec-ch-ua-arch': '"x86"',
        'sec-ch-ua-bitness': '"64"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-user': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
        'DNT': '1'  // Do Not Track – sometimes helps
      },
      timeout: 30000,
      maxRedirects: 10,
      responseType: 'text',
      validateStatus: status => status < 500  // Accept 403/429 to inspect body
    });

    output.debug = `Status: ${response.status} | Length: ${response.data.length}`;

    if (response.status !== 200) {
      output.debug += ` (Non-200: possible block/challenge)`;
      // Check if it's a Cloudflare challenge page
      if (response.data.includes('cf-browser-verification') || response.data.includes('turnstile') || response.data.includes('Just a moment')) {
        output.debug += ' | Cloudflare challenge detected in body';
      }
      throw new Error(`Non-success status: ${response.status}`);
    }

    const $ = cheerio.load(response.data);

    let rankText = '';

    // Try targeted selectors (FACEIT often uses these or similar for stats)
    const possibleElements = [
      '.profile-header__stats-item',
      '[class*="stats"]',
      '[class*="rank"]',
      '[class*="leaderboard"]',
      '[class*="position"]',
      'span:contains("North America")',
      'div:contains("NA")'
    ];

    for (const sel of possibleElements) {
      const el = $(sel);
      if (el.length) {
        rankText = el.text().trim().replace(/\s+/g, ' ');
        if (rankText.includes('North America') || rankText.includes('NA') || /#\d/.test(rankText)) break;
      }
    }

    // Fallback: broad body search
    if (!rankText || !/#\d{3,}/.test(rankText)) {
      const bodyText = $('body').text().replace(/\s+/g, ' ');
      const match = bodyText.match(/(?:North America|NA)\s*.*?[#\s]*(\d{3,6})/i) || bodyText.match(/#(\d{3,6})/);
      if (match) rankText = match[0];
    }

    const numMatch = rankText.match(/(\d{3,6})/);
    if (numMatch) {
      output.rank = numMatch[1];
      output.debug += ' | Extracted rank';
    } else {
      output.debug += ' | No rank pattern found';
    }

  } catch (err) {
    output.debug = `Error: ${err.message}`;
    if (err.response) {
      output.debug += ` | Status: ${err.response.status}`;
      if (err.response.status === 403) output.debug += ' (Cloudflare block)';
    }
    res.status(500);
  }

  res.json(output);
});

module.exports = app;
