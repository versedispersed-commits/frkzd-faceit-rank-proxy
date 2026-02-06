const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

app.get('/rank/:nick', async (req, res) => {
  const { nick } = req.params;

  // Basic validation to prevent junk requests
  if (!nick || nick.length < 2 || nick.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(nick)) {
    return res.status(400).json({ rank: 'Error', debug: 'Invalid nickname (use 2-50 alphanumeric, _, or -)' });
  }

  const output = { rank: 'Error', debug: '' };

  try {
    const response = await axios.get(`https://www.faceit.com/en/players/${nick}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/',
        'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua-platform-version': '"15.0.0"',
        'sec-ch-ua-full-version-list': '"Google Chrome";v="129.0.6668.89", "Not=A?Brand";v="8.0.0.0", "Chromium";v="129.0.6668.89"',
        'sec-ch-ua-model': '""',
        'sec-ch-ua-arch': '"x86"',
        'sec-ch-ua-bitness': '"64"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      },
      timeout: 25000,               // Give Cloudflare/FACEIT more time
      maxRedirects: 5,
      responseType: 'text'
    });

    output.debug = `Status: ${response.status} | Content length: ${response.data.length} bytes`;

    const $ = cheerio.load(response.data);

    let rankText = '';

    // Attempt 1: Look for stats item containing "North America" or "NA"
    const regionStat = $('.profile-header__stats-item:contains("North America"), .profile-header__stats-item:contains("NA")');
    if (regionStat.length) {
      rankText = regionStat.text().trim();
    }

    // Attempt 2: Broader search for any element with leaderboard/rank/position class
    if (!rankText) {
      const rankElements = $('[class*="rank"], [class*="leaderboard"], [class*="position"], [class*="elo"], span, div');
      rankElements.each((i, el) => {
        const txt = $(el).text().trim();
        if (/(North America|NA)\s*[^\d]*#?\d+/i.test(txt) || /#\d{3,6}/.test(txt)) {
          rankText = txt;
          return false; // stop loop
        }
      });
    }

    // Attempt 3: Fallback to raw body text search (last resort)
    if (!rankText) {
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      const naMatch = bodyText.match(/(North America|NA)\s*.*?(?:#|\s*)(\d{3,6})/i) ||
                      bodyText.match(/#(\d{3,6})/);
      if (naMatch) {
        rankText = naMatch[0];
      }
    }

    // Extract the number
    const match = rankText.match(/#?(\d{3,6})/);
    if (match && match[1]) {
      output.rank = match[1];
      output.debug += ' | Rank matched successfully.';
    } else {
      output.debug += ' | No NA/region rank pattern found in page.';
    }

  } catch (err) {
    output.debug = `Request failed: ${err.message}`;
    if (err.response) {
      output.debug += ` | Status: ${err.response.status}`;
      if (err.response.status === 403) {
        output.debug += ' (Likely Cloudflare block - try headers/proxy tweaks)';
      }
      // Optional: log first 200 chars of body if helpful for debug (remove in prod)
      // if (err.response.data) output.debug += ` | Body start: ${err.response.data.slice(0, 200)}`;
    }
    res.status(500);
  }

  res.json(output);
});

// For Vercel serverless (or local node index.js)
module.exports = app;

// Optional: For local testing (uncomment if running with node index.js)
// if (require.main === module) {
//   const port = process.env.PORT || 3000;
//   app.listen(port, () => console.log(`Server running on port ${port}`));
// }
