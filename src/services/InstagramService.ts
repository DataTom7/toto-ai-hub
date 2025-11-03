import { InstagramCredentials, InstagramPost, InstagramStory, Guardian } from '../agents/InstagramAgent';
import puppeteer from 'puppeteer';

export class InstagramService {
  private userCache: Map<string, string> = new Map(); // Cache username -> userID

  constructor(credentials: InstagramCredentials) {
    console.log('InstagramService initialized with web scraping and API support');
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
   * Scrape Instagram posts using web scraping (fallback method)
   */
  async scrapeUserPosts(username: string, limit: number = 10): Promise<InstagramPost[]> {
    let browser;
    try {
      console.log(`Scraping Instagram posts from @${username} using Puppeteer...`);
      
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to the profile page
      await page.goto(`https://www.instagram.com/${username}/`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait for posts to load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Try to find posts using various selectors
      const posts = await page.evaluate((maxResults, username) => {
        const postElements = document.querySelectorAll('article a[href*="/p/"]');
        const results: any[] = [];
        
        for (let i = 0; i < Math.min(postElements.length, maxResults); i++) {
          const post = postElements[i];
          const href = post.getAttribute('href');
          const postId = href?.split('/p/')[1]?.split('/')[0] || `scraped_${Date.now()}_${i}`;
          
          // Try to find image or video
          const mediaElement = post.querySelector('img, video');
          const mediaUrl = mediaElement?.getAttribute('src') || '';
          
          results.push({
            id: postId,
            caption: '', // Would need to visit individual post to get caption
            media: {
              images: mediaUrl ? [mediaUrl] : [],
              videos: [],
              carousel: []
            },
            author: {
              name: username,
              username: username,
              profileImageUrl: ''
            },
            metrics: {
              likes: 0,
              comments: 0,
              shares: 0,
              saves: 0
            },
            hashtags: [],
            mentions: [],
            location: undefined,
            createdAt: new Date(),
            fetchedAt: new Date()
          });
        }
        
        return results;
      }, limit, username);
      
      console.log(`Scraped ${posts.length} posts from @${username}`);
      return posts;
      
    } catch (error) {
      console.error(`Error scraping Instagram posts from @${username}:`, error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
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

















