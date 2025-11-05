import { InstagramCredentials, InstagramPost, InstagramStory, Guardian } from '../agents/InstagramAgent';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

// Using built-in fetch (available in Node.js 18+)

export class InstagramService {
  private userCache: Map<string, string> = new Map(); // Cache username -> userID
  private isLoggedIn: boolean = false;
  private loginUsername: string;
  private loginPassword: string;

  constructor(credentials: InstagramCredentials) {
    console.log('InstagramService initialized with web scraping and API support');
    
    // Load Instagram login credentials from environment
    this.loginUsername = process.env.INSTAGRAM_USERNAME || 'betoto.bot';
    this.loginPassword = process.env.INSTAGRAM_PASSWORD || 'Toto2025?';
    
    if (this.loginUsername && this.loginPassword) {
      console.log(`✅ Instagram login credentials configured for: ${this.loginUsername}`);
    } else {
      console.warn('⚠️ No Instagram login credentials configured - scraping may be limited');
    }
  }

  /**
   * Login to Instagram with bot account to bypass login wall
   * OPTIMIZED: Reduced timeouts and better error handling
   */
  private async loginToInstagram(page: any): Promise<boolean> {
    const loginTimeout = 20000; // 20 second total timeout for login
    const startTime = Date.now();
    
    try {
      console.log(`🔐 Attempting to login to Instagram as ${this.loginUsername}...`);
      
      // Navigate to login page
      await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // Wait a bit for page to fully load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check what page we actually loaded
      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`   Navigated to: ${currentUrl}`);
      console.log(`   Page title: ${pageTitle}`);

      // Try multiple selectors for username field (Instagram changes their structure)
      let usernameSelector = null;
      const possibleSelectors = [
        'input[name="username"]',
        'input[type="text"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="phone" i]',
        'input[aria-label*="username" i]',
        'input[aria-label*="phone" i]'
      ];

      for (const selector of possibleSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            usernameSelector = selector;
            console.log(`   ✅ Found username field with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue trying other selectors
        }
      }

      if (!usernameSelector) {
        // Take screenshot for debugging
        const screenshot = await page.screenshot({ encoding: 'base64' });
        console.error('   ❌ Could not find username input field');
        console.error('   📸 Screenshot saved (check logs for base64 data)');
        
        // Log page content for debugging
        const pageText = await page.evaluate(() => document.body.innerText);
        console.error(`   Page content preview: ${pageText.substring(0, 300)}...`);
        
        return false;
      }
      
      // Type username
      await page.type(usernameSelector, this.loginUsername, { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Find password field (try multiple selectors)
      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[aria-label*="password" i]'
      ];
      
      let passwordSelector = null;
      for (const selector of passwordSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            passwordSelector = selector;
            break;
          }
        } catch (e) {
          // Continue
        }
      }
      
      if (!passwordSelector) {
        console.error('   ❌ Could not find password input field');
        return false;
      }
      
      // Type password
      await page.type(passwordSelector, this.loginPassword, { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 300));

      // Click login button
      await page.click('button[type="submit"]');
      
      // Wait for navigation with timeout
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {
        console.warn('⚠️ Navigation timeout after login - checking current state...');
      });

      // Check if we exceeded timeout
      if (Date.now() - startTime > loginTimeout) {
        console.error('❌ Login timeout exceeded');
        return false;
      }

      // Check if login was successful
      const loginResultUrl = page.url();
      console.log(`   Current URL after login: ${loginResultUrl}`);
      
      // Check for specific error messages on the page
      const pageContent = await page.content();
      const pageText = await page.evaluate(() => document.body.innerText);
      
      if (loginResultUrl.includes('/accounts/login') || loginResultUrl.includes('/challenge')) {
        console.error('❌ Login failed - still on login page');
        
        // Detect specific error types
        if (pageText.includes('suspicious activity') || pageText.includes('verify your account')) {
          console.error('   ⚠️ Instagram detected suspicious activity - manual verification required');
        } else if (pageText.includes('incorrect') || pageText.includes('wrong password')) {
          console.error('   ⚠️ Incorrect username or password');
        } else if (pageText.includes('try again') || pageText.includes('temporarily locked')) {
          console.error('   ⚠️ Account temporarily locked - wait before retrying');
        } else if (loginResultUrl.includes('/challenge')) {
          console.error('   ⚠️ Instagram challenge page - CAPTCHA or verification required');
        } else {
          console.error('   ⚠️ Unknown error - Instagram may be blocking automation');
          console.error(`   Page contains: ${pageText.substring(0, 200)}...`);
        }
        return false;
      }

      // Quick check for popups (don't wait long)
      try {
        // Look for any "Not Now" button
        const notNowButton = await page.$('button:has-text("Not Now")');
        if (notNowButton) {
          await notNowButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (e) {
        // No popup, continue
      }

      console.log(`✅ Successfully logged in to Instagram (${Date.now() - startTime}ms)`);
      this.isLoggedIn = true;
      return true;

    } catch (error) {
      console.error(`❌ Error during Instagram login (${Date.now() - startTime}ms):`, error);
      return false;
    }
  }

  /**
   * Get user posts using Instagram Basic Display API
   */
  async getUserPosts(userId: string, limit: number = 10, accessToken: string): Promise<InstagramPost[]> {
    try {
      console.log(`Fetching posts for user ${userId} using Instagram Basic Display API`);
      
      const response = await fetch(`https://graph.instagram.com/${userId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${accessToken}`);
      
      if (!response.ok) {
        throw new Error(`Instagram API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const posts: InstagramPost[] = [];
      
      for (const item of data.data || []) {
        const post: InstagramPost = {
          id: item.id,
          caption: item.caption || '',
          media: {
            images: item.media_type === 'IMAGE' ? [item.media_url] : [],
            videos: item.media_type === 'VIDEO' ? [item.media_url] : [],
            carousel: item.media_type === 'CAROUSEL_ALBUM' ? [item.media_url] : []
          },
          author: {
            name: '', // Will be filled from user profile
            username: '', // Will be filled from user profile
            profileImageUrl: ''
          },
          metrics: {
            likes: 0, // Not available in Basic Display API
            comments: 0, // Not available in Basic Display API
            shares: 0, // Not available in Basic Display API
            saves: 0 // Not available in Basic Display API
          },
          hashtags: this.extractHashtags(item.caption || ''),
          mentions: this.extractMentions(item.caption || ''),
          location: undefined, // Not available in Basic Display API
          createdAt: new Date(item.timestamp),
          fetchedAt: new Date()
        };
        
        posts.push(post);
      }
      
      console.log(`Fetched ${posts.length} posts from Instagram API`);
      return posts;
      
    } catch (error) {
      console.error('Error fetching posts from Instagram API:', error);
      // Fallback to web scraping
      return await this.scrapeUserPosts(userId, limit);
    }
  }

  /**
   * Get user stories using Instagram Basic Display API
   */
  async getUserStories(userId: string, accessToken: string): Promise<InstagramStory[]> {
    try {
      console.log(`Fetching stories for user ${userId} using Instagram Basic Display API`);
      
      const response = await fetch(`https://graph.instagram.com/${userId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=25&access_token=${accessToken}`);
      
      if (!response.ok) {
        throw new Error(`Instagram API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const stories: InstagramStory[] = [];
      
      // Filter for recent posts (stories are typically recent)
      const recentPosts = data.data?.filter((item: any) => {
        const postTime = new Date(item.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - postTime.getTime()) / (1000 * 60 * 60);
        return hoursDiff <= 24; // Stories are typically 24 hours or less
      }) || [];
      
      for (const item of recentPosts) {
        const story: InstagramStory = {
          id: item.id,
          mediaUrl: item.media_url,
          mediaType: item.media_type === 'VIDEO' ? 'video' : 'image',
          caption: item.caption || '',
          author: {
            name: '', // Will be filled from user profile
            username: '' // Will be filled from user profile
          },
          metrics: {
            views: 0, // Not available in Basic Display API
            interactions: 0 // Not available in Basic Display API
          },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Stories expire in 24 hours
          createdAt: new Date(item.timestamp),
          fetchedAt: new Date()
        };
        
        stories.push(story);
      }
      
      console.log(`Fetched ${stories.length} stories from Instagram API`);
      return stories;
      
    } catch (error) {
      console.error('Error fetching stories from Instagram API:', error);
      return [];
    }
  }

  /**
   * Fetch Instagram posts using Instagram's internal API endpoint (NO LOGIN REQUIRED)
   * This is the recommended method for public profiles - faster and more reliable
   */
  async fetchUserPostsViaAPI(username: string, limit: number = 12): Promise<InstagramPost[]> {
    try {
      console.log(`Fetching posts from @${username} using Instagram API endpoint (no login required)...`);

      const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;

      const response = await fetch(url, {
        headers: {
          'X-IG-App-ID': '936619743392459', // Instagram's internal app ID
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.instagram.com/',
          'Origin': 'https://www.instagram.com'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data: any = await response.json();

      if (!data.data || !data.data.user) {
        throw new Error('Invalid API response structure');
      }

      const user = data.data.user;
      const edges = user.edge_owner_to_timeline_media?.edges || [];

      console.log(`  ✅ Found ${edges.length} posts from API`);

      const posts: InstagramPost[] = [];

      for (const edge of edges.slice(0, limit)) {
        const node = edge.node;

        // Extract media URLs
        const images: string[] = [];
        const videos: string[] = [];

        if (node.is_video && node.video_url) {
          videos.push(node.video_url);
        } else if (node.display_url) {
          images.push(node.display_url);
        }

        // Extract caption
        const captionEdges = node.edge_media_to_caption?.edges || [];
        const caption = captionEdges.length > 0 ? captionEdges[0].node.text : '';

        // Build post object
        const post: InstagramPost = {
          id: node.id,
          caption: caption,
          media: {
            images: images,
            videos: videos,
            carousel: []
          },
          author: {
            name: user.full_name || username,
            username: username,
            profileImageUrl: user.profile_pic_url || ''
          },
          metrics: {
            likes: node.edge_liked_by?.count || 0,
            comments: node.edge_media_to_comment?.count || 0,
            shares: 0,
            saves: 0
          },
          hashtags: this.extractHashtags(caption),
          mentions: this.extractMentions(caption),
          createdAt: new Date(node.taken_at_timestamp * 1000),
          fetchedAt: new Date(),
          permalink: `https://www.instagram.com/p/${node.shortcode}/`
        };

        posts.push(post);

        console.log(`  ✅ Post ${posts.length}/${limit}: "${caption.substring(0, 50)}..." (${images.length} images, ${videos.length} videos)`);
      }

      console.log(`✅ Successfully fetched ${posts.length} posts from @${username} via API`);
      return posts;

    } catch (error: any) {
      console.error(`❌ Error fetching posts via API for @${username}:`, error.message);
      console.log('⚠️  Falling back to web scraping method...');
      return [];
    }
  }

  /**
   * Scrape Instagram posts using web scraping (fallback method)
   * Now visits individual posts to extract full captions and details
   *
   * UPDATED: Now tries API endpoint first, falls back to web scraping if needed
   */
  async scrapeUserPosts(username: string, limit: number = 10): Promise<InstagramPost[]> {
    // TRY API ENDPOINT FIRST (no login required, faster, more reliable)
    console.log(`Attempting to fetch posts from @${username}...`);
    const apiPosts = await this.fetchUserPostsViaAPI(username, limit);

    if (apiPosts.length > 0) {
      console.log(`✅ Successfully fetched ${apiPosts.length} posts via API (no web scraping needed)`);
      return apiPosts;
    }

    // FALLBACK TO WEB SCRAPING if API fails
    console.log(`⚠️  API method failed, falling back to web scraping with Puppeteer...`);

    let browser;
    const maxScrapingTime = 120000; // 2 minute max
    const startTime = Date.now();

    try {
      console.log(`Scraping Instagram posts from @${username} using Puppeteer...`);
      console.log(`⏱️  Max scraping time: ${maxScrapingTime / 1000} seconds`);

      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      const page = await browser.newPage();
      
      // Set realistic viewport
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Remove webdriver property
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });

      // Check timeout
      if (Date.now() - startTime > maxScrapingTime) {
        throw new Error('Scraping timeout before login');
      }

      // Login to Instagram first (if not already logged in)
      if (!this.isLoggedIn) {
        const loginSuccess = await this.loginToInstagram(page);
        if (!loginSuccess) {
          console.warn('⚠️ Failed to login to Instagram - returning empty results');
          await browser.close();
          return [];
        }
      }

      // Check timeout
      if (Date.now() - startTime > maxScrapingTime) {
        throw new Error('Scraping timeout after login');
      }

      // Navigate to the profile page
      console.log(`  Navigating to profile: https://www.instagram.com/${username}/`);
      await page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // Wait for posts to load (shorter)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if we hit a login wall
      const pageContent = await page.content();
      if (pageContent.includes('Login') || pageContent.includes('Log In') || pageContent.includes('Sign up')) {
        console.warn(`⚠️ Instagram is showing a login wall for @${username}`);
        console.warn(`   This is expected - Instagram requires login for scraping`);
        console.warn(`   Returning empty results. To enable Instagram scraping:`);
        console.warn(`   1. Configure Instagram API credentials (preferred)`);
        console.warn(`   2. Or use a logged-in browser session`);
        await browser.close();
        return [];
      }

      // Extract post URLs from profile page
      console.log(`  Extracting post URLs...`);
      const postUrls = await page.evaluate((maxResults) => {
        const postElements = document.querySelectorAll('article a[href*="/p/"]');
        const urls: string[] = [];

        console.log(`    Found ${postElements.length} post elements in DOM`);

        for (let i = 0; i < Math.min(postElements.length, maxResults); i++) {
          const href = postElements[i].getAttribute('href');
          if (href) {
            urls.push(`https://www.instagram.com${href}`);
          }
        }

        return urls;
      }, limit);

      console.log(`✅ Successfully extracted ${postUrls.length} post URLs`);
      
      if (postUrls.length === 0) {
        console.warn(`⚠️ No posts found for @${username}`);
        console.warn(`   This could mean:`);
        console.warn(`   1. The profile has no posts`);
        console.warn(`   2. Instagram is blocking scraping`);
        console.warn(`   3. Page structure has changed`);
      }

      const posts: InstagramPost[] = [];

      // Visit each post URL individually to extract full details
      for (let i = 0; i < postUrls.length; i++) {
        const postUrl = postUrls[i];

        try {
          console.log(`  [${i + 1}/${postUrls.length}] Scraping post: ${postUrl}`);

          // Navigate to individual post
          await page.goto(postUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });

          // Wait for post content to load
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Extract post details
          const postData = await page.evaluate((url, username) => {
            // Extract post ID from URL
            const postId = url.split('/p/')[1]?.split('/')[0] || `scraped_${Date.now()}`;

            // Try multiple selectors for caption
            let caption = '';

            // Method 1: Look for h1 containing the caption
            const h1Element = document.querySelector('article h1');
            if (h1Element && h1Element.textContent) {
              caption = h1Element.textContent.trim();
            }

            // Method 2: Look for meta tag with caption
            if (!caption) {
              const metaDescription = document.querySelector('meta[property="og:description"]');
              if (metaDescription) {
                const content = metaDescription.getAttribute('content');
                if (content) {
                  caption = content.trim();
                }
              }
            }

            // Method 3: Look for any span/div with caption-like content in article
            if (!caption) {
              const articleElement = document.querySelector('article');
              if (articleElement) {
                const spans = Array.from(articleElement.querySelectorAll('span, div'));
                for (const span of spans) {
                  const text = span.textContent?.trim() || '';
                  // Caption is usually longer than a few words
                  if (text.length > 20 && text.length < 2500) {
                    caption = text;
                    break;
                  }
                }
              }
            }

            // Extract images - look for high-res images
            const images: string[] = [];
            const imgElements = Array.from(document.querySelectorAll('article img'));
            imgElements.forEach((img: any) => {
              const src = img.src || img.getAttribute('src');
              // Filter out profile pics, icons, and emoji
              if (src && !src.includes('profile_images') && !src.includes('emoji')) {
                // Try to get highest quality version
                const highResSrc = src.replace(/\/s\d+x\d+\//, '/').replace(/\/\w+x\w+\//, '/');
                images.push(highResSrc);
              }
            });

            // Extract videos
            const videos: string[] = [];
            const videoElements = Array.from(document.querySelectorAll('article video'));
            videoElements.forEach((video: any) => {
              const src = video.src || video.getAttribute('src');
              if (src) {
                videos.push(src);
              }
            });

            // Try to extract timestamp
            let createdAt = new Date();
            const timeElement = document.querySelector('time');
            if (timeElement) {
              const datetime = timeElement.getAttribute('datetime');
              if (datetime) {
                createdAt = new Date(datetime);
              }
            }

            // Try to extract metrics (likes, comments)
            let likes = 0;
            let comments = 0;

            // Look for likes count
            const likesSection = document.querySelector('section a[href*="/liked_by/"]');
            if (likesSection && likesSection.textContent) {
              const likesMatch = likesSection.textContent.match(/[\d,]+/);
              if (likesMatch) {
                likes = parseInt(likesMatch[0].replace(/,/g, ''));
              }
            }

            // Look for comments count
            const commentsSection = document.querySelector('a[href*="#comments"]');
            if (commentsSection && commentsSection.textContent) {
              const commentsMatch = commentsSection.textContent.match(/[\d,]+/);
              if (commentsMatch) {
                comments = parseInt(commentsMatch[0].replace(/,/g, ''));
              }
            }

            return {
              id: postId,
              caption: caption,
              images: [...new Set(images)], // Remove duplicates
              videos: videos,
              createdAt: createdAt.toISOString(),
              likes: likes,
              comments: comments,
              username: username
            };
          }, postUrl, username);

          // Build InstagramPost object
          const post: InstagramPost = {
            id: postData.id,
            caption: postData.caption,
            media: {
              images: postData.images,
              videos: postData.videos,
              carousel: [] // Could enhance this later
            },
            author: {
              name: username,
              username: username,
              profileImageUrl: ''
            },
            metrics: {
              likes: postData.likes,
              comments: postData.comments,
              shares: 0,
              saves: 0
            },
            hashtags: this.extractHashtags(postData.caption),
            mentions: this.extractMentions(postData.caption),
            createdAt: new Date(postData.createdAt),
            fetchedAt: new Date(),
            permalink: postUrl
          };

          posts.push(post);
          console.log(`    ✅ Extracted: "${postData.caption.substring(0, 50)}..." (${postData.images.length} images, ${postData.videos.length} videos)`);

          // Add delay between posts to avoid rate limiting (2-4 seconds random)
          if (i < postUrls.length - 1) {
            const delay = 2000 + Math.random() * 2000;
            console.log(`    ⏳ Waiting ${(delay / 1000).toFixed(1)}s before next post...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

        } catch (postError) {
          console.error(`    ❌ Error scraping post ${postUrl}:`, postError instanceof Error ? postError.message : postError);
          // Continue with next post
        }
      }

      const elapsedTime = Date.now() - startTime;
      console.log(`✅ Successfully scraped ${posts.length} posts from @${username} in ${elapsedTime}ms`);
      return posts;

    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`❌ Error scraping Instagram posts from @${username} after ${elapsedTime}ms:`, error);
      return [];
    } finally {
      if (browser) {
        try {
          await browser.close();
          console.log(`🔒 Browser closed`);
        } catch (e) {
          console.error('Error closing browser:', e);
        }
      }
    }
  }

  /**
   * Extract hashtags from caption text
   */
  private extractHashtags(caption: string): string[] {
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
    return caption.match(hashtagRegex) || [];
  }

  /**
   * Extract mentions from caption text
   */
  private extractMentions(caption: string): string[] {
    const mentionRegex = /@[\w\u0590-\u05ff]+/g;
    return caption.match(mentionRegex) || [];
  }

  /**
   * Test Instagram connection
   */
  async testConnection(accessToken?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (accessToken) {
        // Test API connection
        const response = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`);
        
        if (!response.ok) {
          return { success: false, error: `Instagram API error: ${response.status} ${response.statusText}` };
        }
        
        const data = await response.json();
        console.log('Instagram API connection test successful');
        return { success: true, message: `Connected as @${data.username}` };
      } else {
        // Test web scraping connection
        console.log('Testing Instagram web scraping connection...');
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.goto('https://www.instagram.com', { timeout: 10000 });
        await browser.close();
        
        console.log('Instagram web scraping connection test successful');
        return { success: true, message: 'Instagram web scraping connection successful' };
      }
    } catch (error) {
      console.error('Instagram connection test failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get current rate limit status
   */
  getCurrentRateLimitStatus() {
    return {
      'instagram_api': {
        remaining: 200, // Instagram Basic Display API limit
        resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
        resetInSeconds: 3600,
        canMakeRequest: true
      },
      'web_scraping': {
        remaining: 999,
        resetTime: new Date().toISOString(),
        resetInSeconds: 0,
        canMakeRequest: true
      }
    };
  }

  /**
   * Get post insights (requires Instagram Business API)
   */
  async getPostInsights(postId: string, accessToken: string): Promise<any> {
    try {
      const response = await fetch(`https://graph.instagram.com/${postId}/insights?metric=impressions,reach,likes,comments,shares,saves&access_token=${accessToken}`);
      
      if (!response.ok) {
        throw new Error(`Instagram Insights API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching post insights:', error);
      return null;
    }
  }

  /**
   * Search for posts by hashtag (requires Instagram Business API)
   */
  async searchPostsByHashtag(hashtag: string, limit: number = 10, accessToken: string): Promise<InstagramPost[]> {
    try {
      // This would require Instagram Business API
      // For now, return empty array
      console.log(`Hashtag search for #${hashtag} requires Instagram Business API`);
      return [];
    } catch (error) {
      console.error('Error searching posts by hashtag:', error);
      return [];
    }
  }
}

















