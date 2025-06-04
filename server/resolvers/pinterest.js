const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const PinterestImage = require('../models/pinterestImage');

// Helper function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  Query: {
    getPinterestImages: async (_, { query, limit = 30 }, { user, PinterestImage }) => {
      try {
        const queryOptions = query ? { query } : {};
        if (user) queryOptions.userId = user.userId;
        return await PinterestImage.find(queryOptions).limit(limit);
      } catch (error) {
        throw new Error(`Failed to fetch Pinterest images: ${error.message}`);
      }
    },
  },
  Mutation: {
    scrapePinterestImages: async (_, { query, limit = 30 }, { user, PinterestImage }) => {
      if (!query) throw new Error('Query is required');
      
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      const images = [];

      try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
        await page.goto(url, { waitUntil: 'networkidle2' });

        let previousHeight;
        while (images.length < limit) {
          const divCards = await page.$$("div[data-grid-item='true']");
          for (const divCard of divCards) {
            if (images.length >= limit) break;
            const imgElement = await divCard.$('img');
            if (imgElement) {
              const src = await page.evaluate(el => el.getAttribute('src'), imgElement);
              const alt = await page.evaluate(el => el.getAttribute('alt'), imgElement);
              if (src && !images.some(img => img.src === src)) {
                images.push({ src, alt, query, timestamp: new Date(), userId: user ? user.userId : null });
              }
            }
          }
          previousHeight = await page.evaluate('document.body.scrollHeight');
          await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
          await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`, { timeout: 5000 });
          await delay(1000);
        }

        let savedImages = [];
        if (images.length > 0) {
          savedImages = await PinterestImage.insertMany(images);
        }

        // Map savedImages to ensure id is included
        const formattedImages = savedImages.map(img => ({
          id: img._id.toString(),
          src: img.src,
          alt: img.alt,
          query: img.query,
          timestamp: img.timestamp.toISOString(),
        }));

        return { message: 'Scraping complete', images: formattedImages };
      } catch (error) {
        throw new Error(`Scraping failed: ${error.message}`);
      } finally {
        await browser.close();
      }
    },
  },
};