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
  private lastLoginAttempt: Date | null = null;
  private loginAttemptCount: number = 0;
  private readonly LOGIN_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown between login attempts
  private readonly MAX_LOGIN_ATTEMPTS = 3; // Max attempts before cooldown

  constructor(credentials: InstagramCredentials) {
    console.log('InstagramService initialized with web scraping and API support');
    
    // Load Instagram login credentials from environment (secrets)
    // These are stored in Google Secret Manager and referenced in apphosting.yaml
    this.loginUsername = process.env.INSTAGRAM_USERNAME || '';
    this.loginPassword = process.env.INSTAGRAM_PASSWORD || '';
    
    if (this.loginUsername && this.loginPassword) {
      console.log(`✅ Instagram login credentials configured for: ${this.loginUsername}`);
    } else {
      console.warn('⚠️ No Instagram login credentials configured - scraping may be limited');
      console.warn('   Set INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD secrets in Secret Manager');
    }
  }

  /**
   * Login to Instagram with bot account to bypass login wall
   * OPTIMIZED: Reduced timeouts and better error handling
   */
  private async loginToInstagram(page: any): Promise<boolean> {
    const loginTimeout = 30000; // 30 second total timeout for login
    const startTime = Date.now();
    
    // Check if we should wait due to rate limiting
    const now = new Date();
    if (this.lastLoginAttempt) {
      const timeSinceLastAttempt = now.getTime() - this.lastLoginAttempt.getTime();
      if (timeSinceLastAttempt < this.LOGIN_COOLDOWN_MS) {
        const remainingMinutes = Math.ceil((this.LOGIN_COOLDOWN_MS - timeSinceLastAttempt) / 60000);
        console.warn(`⚠️ Login cooldown active - ${remainingMinutes} minute(s) remaining before next attempt`);
        console.warn(`   This is likely due to rate limiting from too many login attempts`);
        return false;
      }
      
      // Reset attempt count if enough time has passed
      if (timeSinceLastAttempt > this.LOGIN_COOLDOWN_MS) {
        this.loginAttemptCount = 0;
      }
    }
    
    // Check if we've exceeded max attempts
    if (this.loginAttemptCount >= this.MAX_LOGIN_ATTEMPTS) {
      const timeSinceLastAttempt = this.lastLoginAttempt ? 
        now.getTime() - this.lastLoginAttempt.getTime() : 0;
      const remainingMinutes = Math.ceil((this.LOGIN_COOLDOWN_MS - timeSinceLastAttempt) / 60000);
      console.error(`❌ Too many login attempts (${this.loginAttemptCount}) - Instagram may be rate limiting`);
      console.error(`   Please wait ${remainingMinutes} minute(s) before trying again`);
      return false;
    }
    
    try {
      this.loginAttemptCount++;
      this.lastLoginAttempt = now;
      console.log(`🔐 Attempting to login to Instagram as ${this.loginUsername}... (attempt ${this.loginAttemptCount}/${this.MAX_LOGIN_ATTEMPTS})`);
      
      // Navigate to login page
      await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // Wait for page to fully load and check what we got
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check what page we actually loaded
      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`   Navigated to: ${currentUrl}`);
      console.log(`   Page title: ${pageTitle}`);

      // Wait for login form to be visible
      try {
        await page.waitForSelector('form', { timeout: 5000 });
      } catch (e) {
        console.warn('   ⚠️ Could not find form element');
      }

      // Try multiple selectors for username field (Instagram changes their structure frequently)
      let usernameSelector = null;
      const possibleSelectors = [
        'input[autocomplete="username"]',
        'input[autocomplete="tel"]',
        'input[name="username"]',
        'input[name="text"]',
        'input[type="text"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="phone" i]',
        'input[placeholder*="email" i]',
        'input[aria-label*="username" i]',
        'input[aria-label*="phone" i]',
        'input[aria-label*="email" i]',
        'input[id*="username" i]',
        'input[id*="phone" i]',
        'input[id*="email" i]',
        // Try to find first text input in form
        'form input[type="text"]:first-of-type',
        'form input:not([type="password"]):first-of-type'
      ];

      for (const selector of possibleSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            // Verify it's visible and enabled
            const isVisible = await page.evaluate((el: HTMLElement) => {
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden' && !(el as HTMLInputElement).disabled;
            }, element);
            
            if (isVisible) {
              usernameSelector = selector;
              console.log(`   ✅ Found username field with selector: ${selector}`);
              break;
            }
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
        'input[autocomplete="current-password"]',
        'input[name="password"]',
        'input[type="password"]',
        'input[aria-label*="password" i]',
        'input[id*="password" i]',
        'form input[type="password"]'
      ];
      
      let passwordSelector = null;
      for (const selector of passwordSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            // Verify it's visible and enabled
            const isVisible = await page.evaluate((el: HTMLElement) => {
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden' && !(el as HTMLInputElement).disabled;
            }, element);
            
            if (isVisible) {
              passwordSelector = selector;
              console.log(`   ✅ Found password field with selector: ${selector}`);
              break;
            } else {
              console.log(`   ⚠️ Password field found with ${selector} but not visible`);
            }
          }
        } catch (e) {
          // Continue
        }
      }
      
      if (!passwordSelector) {
        console.error('   ❌ Could not find password input field');
        // Debug: List all input fields on the page
        const allInputs = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'));
          return inputs.map((input: HTMLInputElement) => ({
            type: input.type,
            name: input.name,
            id: input.id,
            autocomplete: input.autocomplete,
            placeholder: input.placeholder,
            ariaLabel: input.getAttribute('aria-label')
          }));
        });
        console.error(`   📋 Found ${allInputs.length} input fields on page:`, JSON.stringify(allInputs, null, 2));
        return false;
      }
      
      // Type password
      await page.type(passwordSelector, this.loginPassword, { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`   ✅ Typed password (${this.loginPassword.length} characters)`);

      // Wait a bit before clicking login
      await new Promise(resolve => setTimeout(resolve, 500));

      // Try multiple selectors for login button
      const loginButtonSelectors = [
        'button[type="submit"]',
        'button:has-text("Log in")',
        'button:has-text("Log In")',
        'button:has-text("Login")',
        'form button[type="submit"]',
        'button._acan._acap._acas._aj1-'
      ];

      let loginButtonClicked = false;
      for (const selector of loginButtonSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            const isVisible = await page.evaluate((el: HTMLElement) => {
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden';
            }, button);
            
            if (isVisible) {
              console.log(`   ✅ Found login button with selector: ${selector}`);
              await button.click();
              loginButtonClicked = true;
              break;
            }
          }
        } catch (e) {
          // Continue trying other selectors
        }
      }

      if (!loginButtonClicked) {
        console.error('   ❌ Could not find or click login button');
        return false;
      }
      
      // Wait a bit for the page to respond
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Wait for navigation with timeout
      try {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 });
      } catch (navError) {
        console.warn('⚠️ Navigation timeout after login - checking current state...');
      }

      // Wait a bit more and check the page state
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if login was successful FIRST (before timeout check)
      let loginResultUrl = '';
      let pageText = '';
      try {
        loginResultUrl = page.url();
        console.log(`   Current URL after login: ${loginResultUrl}`);
        pageText = await page.evaluate(() => document.body.innerText);
      } catch (pageError) {
        console.error(`   ⚠️ Error checking page state: ${pageError instanceof Error ? pageError.message : 'Unknown error'}`);
      }
      
      // Check if we exceeded timeout (after checking page state)
      if (Date.now() - startTime > loginTimeout) {
        console.error(`❌ Login timeout exceeded (${Date.now() - startTime}ms)`);
        // Still check page state to see what Instagram is showing
        if (pageText) {
          console.error(`   Page content: ${pageText.substring(0, 300)}...`);
        }
        if (loginResultUrl) {
          console.error(`   Final URL: ${loginResultUrl}`);
        }
        return false;
      }
      
      // Check for specific error messages on the page (reuse pageText if we already have it)
      const pageContent = await page.content();
      if (!pageText) {
        pageText = await page.evaluate(() => document.body.innerText);
      }
      
      // Check for challenge/CAPTCHA pages
      const hasChallenge = loginResultUrl.includes('/challenge') || 
                           loginResultUrl.includes('/accounts/suspended') ||
                           pageText.includes('suspicious activity') ||
                           pageText.includes('verify your account') ||
                           pageText.includes('Help us confirm') ||
                           await page.$('input[name="verificationCode"]') !== null ||
                           await page.$('button:has-text("Verify")') !== null;
      
      if (hasChallenge) {
        console.error('❌ Login blocked - Instagram challenge/CAPTCHA detected');
        console.error('   ⚠️ Instagram requires manual verification - cannot proceed with automation');
        console.error(`   Current URL: ${loginResultUrl}`);
        return false;
      }
      
      if (loginResultUrl.includes('/accounts/login')) {
        console.error('❌ Login failed - still on login page');
        
        // Check for error messages
        const errorSelectors = [
          'div[role="alert"]',
          'p:has-text("incorrect")',
          'p:has-text("wrong")',
          'span:has-text("Sorry")'
        ];
        
        let errorFound = false;
        for (const selector of errorSelectors) {
          try {
            const errorElement = await page.$(selector);
            if (errorElement) {
              const errorText = await page.evaluate((el: HTMLElement) => el.innerText, errorElement);
              if (errorText) {
                console.error(`   ⚠️ Error message: ${errorText.substring(0, 100)}`);
                errorFound = true;
                break;
              }
            }
          } catch (e) {
            // Continue
          }
        }
        
        // Detect specific error types
        if (pageText.includes('suspicious activity') || pageText.includes('verify your account')) {
          console.error('   ⚠️ Instagram detected suspicious activity - manual verification required');
        } else if (pageText.includes('incorrect') || pageText.includes('wrong password')) {
          // Instagram often shows "incorrect password" even when password is correct but automation is detected
          // Check if this might be automation blocking rather than actual wrong password
          const mightBeAutomationBlock = this.loginAttemptCount > 1 || 
                                        pageText.includes('try again') ||
                                        pageText.includes('temporarily');
          
          if (mightBeAutomationBlock) {
            console.error('   ⚠️ Instagram may be blocking automation (showing "incorrect password" as generic error)');
            console.error('   💡 Try logging in manually in a browser first to "unlock" the account');
            console.error('   💡 Wait 10-15 minutes before retrying automated login');
            // Reset attempt count to force cooldown
            this.loginAttemptCount = this.MAX_LOGIN_ATTEMPTS;
          } else {
            console.error('   ⚠️ Incorrect username or password (or automation detected)');
            console.error('   💡 If password is correct, Instagram is likely blocking automation');
          }
        } else if (pageText.includes('try again') || pageText.includes('temporarily locked')) {
          console.error('   ⚠️ Account temporarily locked - wait before retrying');
          // Reset attempt count to force cooldown
          this.loginAttemptCount = this.MAX_LOGIN_ATTEMPTS;
        } else if (pageText.includes('try again later') || pageText.includes('too many') || pageText.includes('rate limit')) {
          console.error('   ⚠️ Rate limiting detected - too many login attempts');
          // Reset attempt count to force cooldown
          this.loginAttemptCount = this.MAX_LOGIN_ATTEMPTS;
        } else if (!errorFound) {
          console.error('   ⚠️ Unknown error - Instagram may be blocking automation');
          console.error(`   Page contains: ${pageText.substring(0, 200)}...`);
        }
        return false;
      }
      
      // Check if we're on the main Instagram page (successful login)
      if (loginResultUrl.includes('instagram.com') && 
          !loginResultUrl.includes('/accounts/') && 
          !loginResultUrl.includes('/challenge')) {
        console.log('   ✅ Successfully navigated away from login page');
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
      // Reset attempt count on successful login
      this.loginAttemptCount = 0;
      this.lastLoginAttempt = null;
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
        const images: string[] = [];
        const videos: string[] = [];
        const carousel: string[] = [];
        
        // Handle carousel albums - fetch all children
        if (item.media_type === 'CAROUSEL_ALBUM') {
          try {
            const childrenResponse = await fetch(`https://graph.instagram.com/${item.id}/children?fields=id,media_type,media_url,thumbnail_url&access_token=${accessToken}`);
            if (childrenResponse.ok) {
              const childrenData = await childrenResponse.json();
              for (const child of childrenData.data || []) {
                if (child.media_type === 'IMAGE' && child.media_url) {
                  images.push(child.media_url);
                  carousel.push(child.media_url);
                } else if (child.media_type === 'VIDEO' && child.media_url) {
                  videos.push(child.media_url);
                  carousel.push(child.media_url);
                }
              }
            } else {
              // Fallback: use the main media_url if children fetch fails
              if (item.media_url) {
                images.push(item.media_url);
                carousel.push(item.media_url);
              }
            }
          } catch (childrenError) {
            console.warn(`Failed to fetch carousel children for ${item.id}:`, childrenError);
            // Fallback: use the main media_url
            if (item.media_url) {
              images.push(item.media_url);
              carousel.push(item.media_url);
            }
          }
        } else if (item.media_type === 'IMAGE' && item.media_url) {
          images.push(item.media_url);
        } else if (item.media_type === 'VIDEO' && item.media_url) {
          videos.push(item.media_url);
        }
        
        const post: InstagramPost = {
          id: item.id,
          caption: item.caption || '',
          media: {
            images: images,
            videos: videos,
            carousel: carousel
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

      // Try alternative endpoint first (public profile page)
      const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;

      const response = await fetch(url, {
        headers: {
          'X-IG-App-ID': '936619743392459', // Instagram's internal app ID
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': `https://www.instagram.com/${username}/`,
          'Origin': 'https://www.instagram.com',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'X-CSRFToken': 'missing' // Some endpoints require this even if empty
        }
      });

      let data: any;
      
      if (!response.ok) {
        // If 401, try the i.instagram.com endpoint as fallback
        if (response.status === 401) {
          console.log(`  ⚠️ www.instagram.com endpoint returned 401, trying i.instagram.com...`);
          const altUrl = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
          const altResponse = await fetch(altUrl, {
            headers: {
              'X-IG-App-ID': '936619743392459',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              'Accept': '*/*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': `https://www.instagram.com/${username}/`,
              'Origin': 'https://www.instagram.com'
            }
          });
          
          if (!altResponse.ok) {
            throw new Error(`API request failed with status ${altResponse.status} (both endpoints failed)`);
          }
          
          data = await altResponse.json();
        } else {
          throw new Error(`API request failed with status ${response.status}`);
        }
      } else {
        data = await response.json();
      }

      if (!data.data || !data.data.user) {
        throw new Error('Invalid API response structure');
      }

      const user = data.data.user;
      const edges = user.edge_owner_to_timeline_media?.edges || [];

      console.log(`  ✅ Found ${edges.length} posts from API`);

      const posts: InstagramPost[] = [];
      
      // Helper function to normalize URLs (remove query params that don't affect the image)
      const normalizeUrl = (url: string): string => {
        try {
          const urlObj = new URL(url);
          // Remove query parameters that don't change the actual image
          urlObj.searchParams.delete('_nc_cat');
          urlObj.searchParams.delete('_nc_sid');
          urlObj.searchParams.delete('_nc_ohc');
          urlObj.searchParams.delete('_nc_ht');
          urlObj.searchParams.delete('ccb');
          urlObj.searchParams.delete('oe');
          urlObj.searchParams.delete('oh');
          return urlObj.toString();
        } catch {
          return url;
        }
      };

      // Helper function to fetch carousel children for a post
      const fetchCarouselChildren = async (shortcode: string): Promise<{ images: string[], videos: string[] }> => {
        const images: string[] = [];
        const videos: string[] = [];
        const seenUrls = new Set<string>(); // Track normalized URLs to avoid duplicates
        
        try {
          // Try to fetch post details from Instagram's post API
          const postUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
          const postResponse = await fetch(postUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': '*/*',
              'Referer': 'https://www.instagram.com/',
            }
          });
          
          if (postResponse.ok) {
            const postData = await postResponse.json();
            // Try to extract carousel items from various possible locations
            const graphql = postData.graphql?.shortcode_media || postData.items?.[0];
            if (graphql?.edge_sidecar_to_children?.edges) {
              for (const edge of graphql.edge_sidecar_to_children.edges) {
                const node = edge.node;
                if (node.is_video && node.video_url) {
                  const normalizedUrl = normalizeUrl(node.video_url);
                  if (!seenUrls.has(normalizedUrl)) {
                    videos.push(node.video_url);
                    seenUrls.add(normalizedUrl);
                  }
                } else if (node.display_url) {
                  const normalizedUrl = normalizeUrl(node.display_url);
                  if (!seenUrls.has(normalizedUrl)) {
                    images.push(node.display_url);
                    seenUrls.add(normalizedUrl);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn(`  ⚠️ Could not fetch carousel children for ${shortcode}:`, error);
        }
        
        return { images, videos };
      };

      for (const edge of edges.slice(0, limit)) {
        const node = edge.node;

        // Extract media URLs
        const images: string[] = [];
        const videos: string[] = [];
        const carousel: string[] = [];

        // Check if this is a carousel post - prioritize __typename check first
        // The web_profile_info endpoint may not include edge_sidecar_to_children
        const isCarousel = node.__typename === 'GraphSidecar' || 
                          node.__typename === 'Sidecar' ||
                          !!node.edge_sidecar_to_children;

        if (isCarousel && node.shortcode) {
          // Carousel post detected - fetch all media items
          console.log(`  📸 Carousel post detected (${node.id}, shortcode: ${node.shortcode}, typename: ${node.__typename})`);
          
          // Helper to normalize URLs for duplicate detection
          const normalizeUrl = (url: string): string => {
            try {
              const urlObj = new URL(url);
              // Remove query parameters that don't change the actual image
              urlObj.searchParams.delete('_nc_cat');
              urlObj.searchParams.delete('_nc_sid');
              urlObj.searchParams.delete('_nc_ohc');
              urlObj.searchParams.delete('_nc_ht');
              urlObj.searchParams.delete('ccb');
              urlObj.searchParams.delete('oe');
              urlObj.searchParams.delete('oh');
              return urlObj.toString();
            } catch {
              return url;
            }
          };
          
          const seenUrls = new Set<string>(); // Track normalized URLs to avoid duplicates
          let extractedFromSidecar = false;
          
          // First, try to extract from edge_sidecar_to_children if available
          const sidecarData = node.edge_sidecar_to_children || node.sidecar_to_children;
          if (sidecarData && sidecarData.edges) {
            const carouselEdges = sidecarData.edges || [];
            console.log(`  📦 Extracting ${carouselEdges.length} items from edge_sidecar_to_children`);
            for (const carouselEdge of carouselEdges) {
              const carouselNode = carouselEdge.node || carouselEdge;
              // Prefer display_url over thumbnail_src, and check for duplicates using normalized URLs
              if (carouselNode.is_video && carouselNode.video_url) {
                const normalizedUrl = normalizeUrl(carouselNode.video_url);
                if (!seenUrls.has(normalizedUrl)) {
                  videos.push(carouselNode.video_url);
                  carousel.push(carouselNode.video_url);
                  seenUrls.add(normalizedUrl);
                }
              } else if (carouselNode.display_url) {
                const normalizedUrl = normalizeUrl(carouselNode.display_url);
                if (!seenUrls.has(normalizedUrl)) {
                  images.push(carouselNode.display_url);
                  carousel.push(carouselNode.display_url);
                  seenUrls.add(normalizedUrl);
                }
              } else if (carouselNode.thumbnail_src) {
                const normalizedUrl = normalizeUrl(carouselNode.thumbnail_src);
                if (!seenUrls.has(normalizedUrl)) {
                  images.push(carouselNode.thumbnail_src);
                  carousel.push(carouselNode.thumbnail_src);
                  seenUrls.add(normalizedUrl);
                }
              }
            }
            extractedFromSidecar = true; // Mark that we successfully extracted from sidecar
          } else {
            // Fallback: fetch carousel data via individual post API call
            console.log(`  🔄 Fetching carousel data for post ${node.shortcode} (no edge_sidecar_to_children found)...`);
            try {
              const carouselData = await fetchCarouselChildren(node.shortcode);
              
              // Add images with duplicate check using normalized URLs (reuse seenUrls from above)
              for (const imgUrl of carouselData.images) {
                const normalizedUrl = normalizeUrl(imgUrl);
                if (!seenUrls.has(normalizedUrl)) {
                  images.push(imgUrl);
                  carousel.push(imgUrl);
                  seenUrls.add(normalizedUrl);
                }
              }
              
              // Add videos with duplicate check using normalized URLs
              for (const vidUrl of carouselData.videos) {
                const normalizedUrl = normalizeUrl(vidUrl);
                if (!seenUrls.has(normalizedUrl)) {
                  videos.push(vidUrl);
                  carousel.push(vidUrl);
                  seenUrls.add(normalizedUrl);
                }
              }
              
              if (carouselData.images.length > 0 || carouselData.videos.length > 0) {
                console.log(`  ✅ Fetched ${images.length} unique images and ${videos.length} unique videos from carousel`);
                extractedFromSidecar = true; // Mark that we successfully extracted from carousel
              } else {
                console.log(`  ⚠️ No carousel data found, falling back to single media`);
                // Fallback to single media if carousel fetch fails (only if not already in seenUrls)
                if (node.is_video && node.video_url) {
                  const normalizedUrl = normalizeUrl(node.video_url);
                  if (!seenUrls.has(normalizedUrl)) {
                    videos.push(node.video_url);
                    seenUrls.add(normalizedUrl);
                  }
                } else if (node.display_url) {
                  const normalizedUrl = normalizeUrl(node.display_url);
                  if (!seenUrls.has(normalizedUrl)) {
                    images.push(node.display_url);
                    seenUrls.add(normalizedUrl);
                  }
                }
              }
            } catch (error) {
              console.log(`  ⚠️ Error fetching carousel data: ${error instanceof Error ? error.message : 'Unknown error'}, falling back to single media`);
              // Fallback to single media if carousel fetch fails (only if not already in seenUrls)
              if (node.is_video && node.video_url) {
                const normalizedUrl = normalizeUrl(node.video_url);
                if (!seenUrls.has(normalizedUrl)) {
                  videos.push(node.video_url);
                  seenUrls.add(normalizedUrl);
                }
              } else if (node.display_url) {
                const normalizedUrl = normalizeUrl(node.display_url);
                if (!seenUrls.has(normalizedUrl)) {
                  images.push(node.display_url);
                  seenUrls.add(normalizedUrl);
                }
              }
            }
          }
          
          // IMPORTANT: If we successfully extracted from carousel, DON'T add the main node's media
          // because it's already included in the carousel items (usually as the first item)
          if (!extractedFromSidecar) {
            // Only add main node media if we didn't extract from carousel
            if (node.is_video && node.video_url) {
              const normalizedUrl = normalizeUrl(node.video_url);
              if (!seenUrls.has(normalizedUrl)) {
                videos.push(node.video_url);
                seenUrls.add(normalizedUrl);
              }
            } else if (node.display_url) {
              const normalizedUrl = normalizeUrl(node.display_url);
              if (!seenUrls.has(normalizedUrl)) {
                images.push(node.display_url);
                seenUrls.add(normalizedUrl);
              }
            }
          }
        } else {
          // Single media post
          if (node.is_video && node.video_url) {
            videos.push(node.video_url);
          } else if (node.display_url) {
            images.push(node.display_url);
          }
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
            carousel: carousel
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

        const totalMedia = images.length + videos.length;
        const carouselInfo = carousel.length > 0 ? `, ${carousel.length} carousel items` : '';
        console.log(`  ✅ Post ${posts.length}/${limit}: "${caption.substring(0, 50)}..." (${images.length} images, ${videos.length} videos${carouselInfo})`);
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

















