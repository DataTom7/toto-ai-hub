import { TwitterCredentials, TweetData, Guardian } from '../agents/TwitterAgent';
import puppeteer from 'puppeteer';

export class TwitterService {
  private userCache: Map<string, string> = new Map(); // Cache username -> userID

  constructor(credentials: TwitterCredentials) {
    console.log('TwitterService initialized with web scraping only (no API credentials needed)');
  }

  /**
   * Get user timeline using web scraping (API disabled)
   */
  async getUserTimeline(usernameOrId: string, maxResults: number = 10, startTime?: Date): Promise<any[]> {
    console.log(`Using web scraping for ${usernameOrId} (API disabled)`);
    return await this.scrapeUserTweets(usernameOrId, maxResults);
  }

  /**
   * Scrape tweets from X profile page using Puppeteer
   */
  async scrapeUserTweets(username: string, maxResults: number = 10): Promise<any[]> {
    let browser;
    try {
      console.log(`Scraping tweets from https://x.com/${username} using Puppeteer...`);
      
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to the profile page
      await page.goto(`https://x.com/${username}`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait for tweets to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to find tweets using various selectors
      const tweets = await page.evaluate((maxResults, username) => {
        const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
        const results: any[] = [];
        
        for (let i = 0; i < Math.min(tweetElements.length, maxResults); i++) {
          const tweet = tweetElements[i];
          const textElement = tweet.querySelector('[data-testid="tweetText"]');
          const timeElement = tweet.querySelector('time');
          const likeElement = tweet.querySelector('[data-testid="like"]');
          const retweetElement = tweet.querySelector('[data-testid="retweet"]');
          const replyElement = tweet.querySelector('[data-testid="reply"]');
          
          // Extract tweet ID from the link
          let tweetId = `scraped_${Date.now()}_${i}`;
          const tweetLink = tweet.querySelector('a[href*="/status/"]');
          if (tweetLink) {
            const href = tweetLink.getAttribute('href');
            const match = href?.match(/\/status\/(\d+)/);
            if (match && match[1]) {
              tweetId = match[1];
            }
          }
          
          // Extract images from tweet
          const imageElements = tweet.querySelectorAll('img[src*="/media/"]');
          const media: any[] = [];
          
          imageElements.forEach((img: any) => {
            const src = img.src;
            // Filter out profile images and emoji
            if (src && src.includes('/media/') && !src.includes('profile_images') && !src.includes('emoji')) {
              media.push({
                type: 'photo',
                url: src.replace(/&name=\w+/, '&name=large') // Get large version
              });
            }
          });
          
          if (textElement) {
            const text = textElement.textContent?.trim() || '';
            const time = timeElement?.getAttribute('datetime') || new Date().toISOString();
            const likes = likeElement?.textContent?.trim() || '0';
            const retweets = retweetElement?.textContent?.trim() || '0';
            const replies = replyElement?.textContent?.trim() || '0';
            
            results.push({
              id: tweetId,
              text: text,
              created_at: time,
              public_metrics: {
                like_count: parseInt(likes.replace(/[^\d]/g, '')) || 0,
                retweet_count: parseInt(retweets.replace(/[^\d]/g, '')) || 0,
                reply_count: parseInt(replies.replace(/[^\d]/g, '')) || 0
              },
              author_id: username,
              media: media.length > 0 ? media : undefined
            });
          }
        }
        
        return results;
      }, maxResults, username);
      
      console.log(`Scraped ${tweets.length} tweets from ${username}`);
      return tweets;
      
    } catch (error) {
      console.error(`Error scraping tweets from ${username}:`, error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Test connection (always returns success since we're using web scraping)
   */
  async testConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    console.log('Testing web scraping connection...');
    try {
      // Test with a simple page load
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.goto('https://x.com', { timeout: 10000 });
      await browser.close();
      
      console.log('Web scraping connection test successful');
      return { success: true, message: 'Web scraping connection successful' };
    } catch (error) {
      console.error('Web scraping connection test failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get current rate limit status (always available for web scraping)
   */
  getCurrentRateLimitStatus() {
    return {
      'web_scraping': {
        remaining: 999,
        resetTime: new Date().toISOString(),
        resetInSeconds: 0,
        canMakeRequest: true
      }
    };
  }
}