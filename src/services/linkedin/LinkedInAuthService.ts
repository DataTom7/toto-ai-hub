/**
 * LinkedIn Authentication Service
 *
 * Handles LinkedIn login, session management, and authentication state.
 * Uses Puppeteer with stealth plugin to avoid bot detection.
 */

import puppeteer, { Browser, Page } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { linkedInConfig, browserConfig, linkedInUrls, linkedInSelectors } from '../../config/linkedin.config';
import { humanBehaviorService } from './HumanBehaviorService';
import { BrowserSession } from '../../types/linkedin.types';

// Add stealth plugin
puppeteer.use(StealthPlugin());

export class LinkedInAuthService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private session: BrowserSession | null = null;
  private isLoggedIn: boolean = false;
  private loginAttempts: number = 0;
  private lastLoginAttempt: Date | null = null;

  private readonly MAX_LOGIN_ATTEMPTS = 3;
  private readonly LOGIN_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    console.log('LinkedInAuthService initialized');
  }

  // ============================================================================
  // BROWSER MANAGEMENT
  // ============================================================================

  /**
   * Launch browser with stealth settings
   */
  async launchBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    console.log('Launching browser with stealth mode...');

    const launchOptions: any = {
      headless: browserConfig.headless,
      args: browserConfig.args,
    };

    // Add proxy if configured
    if (browserConfig.proxyUrl) {
      launchOptions.args.push(`--proxy-server=${browserConfig.proxyUrl}`);
    }

    this.browser = await puppeteer.launch(launchOptions);

    // Initialize session
    this.session = {
      sessionId: `session_${Date.now()}`,
      startTime: new Date(),
      lastActivity: new Date(),
      isLoggedIn: false,
      loginAttempts: 0,
      lastLoginAttempt: null,
      pagesVisited: 0,
      actionsPerformed: 0,
      warnings: [],
      errors: [],
      status: 'initializing',
    };

    console.log(`Browser launched - Session ID: ${this.session.sessionId}`);
    return this.browser;
  }

  /**
   * Create a new page with anti-detection settings
   */
  async createPage(): Promise<Page> {
    if (!this.browser) {
      await this.launchBrowser();
    }

    const page = await this.browser!.newPage();

    // Set viewport
    await page.setViewport(browserConfig.viewport);

    // Set user agent
    await page.setUserAgent(browserConfig.userAgent);

    // Remove webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Override other detection vectors
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override chrome detection
      (window as any).chrome = {
        runtime: {},
      };
    });

    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Set default timeout
    page.setDefaultNavigationTimeout(browserConfig.navigationTimeout);
    page.setDefaultTimeout(browserConfig.waitForSelectorTimeout);

    this.page = page;
    return page;
  }

  /**
   * Get the current page or create one
   */
  async getPage(): Promise<Page> {
    if (!this.page || this.page.isClosed()) {
      return await this.createPage();
    }
    return this.page;
  }

  /**
   * Close browser and cleanup
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('Browser closed');
      } catch (error) {
        console.error('Error closing browser:', error);
      }
      this.browser = null;
      this.page = null;
      this.isLoggedIn = false;
      if (this.session) {
        this.session.status = 'closed';
      }
    }
  }

  // ============================================================================
  // LOGIN MANAGEMENT
  // ============================================================================

  /**
   * Check if we can attempt login (rate limiting)
   */
  private canAttemptLogin(): { canAttempt: boolean; reason?: string; waitMs?: number } {
    const now = Date.now();

    // Check cooldown
    if (this.lastLoginAttempt) {
      const timeSinceLastAttempt = now - this.lastLoginAttempt.getTime();
      if (timeSinceLastAttempt < this.LOGIN_COOLDOWN_MS && this.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        const waitMs = this.LOGIN_COOLDOWN_MS - timeSinceLastAttempt;
        return {
          canAttempt: false,
          reason: `Too many login attempts. Wait ${Math.ceil(waitMs / 60000)} minutes.`,
          waitMs,
        };
      }

      // Reset counter if cooldown passed
      if (timeSinceLastAttempt >= this.LOGIN_COOLDOWN_MS) {
        this.loginAttempts = 0;
      }
    }

    return { canAttempt: true };
  }

  /**
   * Login to LinkedIn
   */
  async login(): Promise<{ success: boolean; error?: string }> {
    // Check rate limiting
    const canLogin = this.canAttemptLogin();
    if (!canLogin.canAttempt) {
      return { success: false, error: canLogin.reason };
    }

    // Validate credentials
    if (!linkedInConfig.email || !linkedInConfig.password) {
      return { success: false, error: 'LinkedIn credentials not configured' };
    }

    const page = await this.getPage();
    const startTime = Date.now();

    try {
      this.loginAttempts++;
      this.lastLoginAttempt = new Date();

      console.log(`Attempting LinkedIn login (attempt ${this.loginAttempts}/${this.MAX_LOGIN_ATTEMPTS})...`);

      // Navigate to login page
      await page.goto(linkedInUrls.login, {
        waitUntil: 'domcontentloaded',
        timeout: browserConfig.navigationTimeout,
      });

      // Wait for page to load
      await humanBehaviorService.randomSleep(2000, 4000);

      // Check if already logged in
      const currentUrl = page.url();
      if (currentUrl.includes('/feed') || currentUrl.includes('/mynetwork')) {
        console.log('Already logged in!');
        this.isLoggedIn = true;
        if (this.session) {
          this.session.isLoggedIn = true;
          this.session.status = 'active';
        }
        return { success: true };
      }

      // Wait for login form
      const selectors = linkedInSelectors.login;

      try {
        await page.waitForSelector(selectors.usernameInput, { timeout: 10000 });
      } catch (e) {
        // Try alternative approach - might be a different login page layout
        console.warn('Standard login form not found, trying alternative selectors...');
      }

      // Type username with human-like delays
      console.log('Entering username...');
      await page.click(selectors.usernameInput);
      await humanBehaviorService.randomSleep(200, 500);

      // Type character by character
      const emailDelays = humanBehaviorService.getCharacterDelays(linkedInConfig.email);
      for (let i = 0; i < linkedInConfig.email.length; i++) {
        await page.type(selectors.usernameInput, linkedInConfig.email[i], { delay: 0 });
        await humanBehaviorService.sleep(emailDelays[i]);
      }

      await humanBehaviorService.randomSleep(500, 1000);

      // Type password
      console.log('Entering password...');
      await page.click(selectors.passwordInput);
      await humanBehaviorService.randomSleep(200, 500);

      const passwordDelays = humanBehaviorService.getCharacterDelays(linkedInConfig.password);
      for (let i = 0; i < linkedInConfig.password.length; i++) {
        await page.type(selectors.passwordInput, linkedInConfig.password[i], { delay: 0 });
        await humanBehaviorService.sleep(passwordDelays[i]);
      }

      await humanBehaviorService.randomSleep(500, 1500);

      // Click login button
      console.log('Clicking login button...');
      await page.click(selectors.submitButton);

      // Wait for navigation
      try {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (navError) {
        console.warn('Navigation timeout - checking page state...');
      }

      await humanBehaviorService.randomSleep(2000, 4000);

      // Check login result
      const loginResult = await this.checkLoginResult(page);

      if (loginResult.success) {
        console.log(`Login successful in ${Date.now() - startTime}ms`);
        this.isLoggedIn = true;
        this.loginAttempts = 0; // Reset on success
        if (this.session) {
          this.session.isLoggedIn = true;
          this.session.status = 'active';
        }
        return { success: true };
      }

      console.error(`Login failed: ${loginResult.error}`);
      if (this.session) {
        this.session.errors.push(loginResult.error || 'Unknown login error');
      }
      return { success: false, error: loginResult.error };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during login';
      console.error(`Login error after ${Date.now() - startTime}ms:`, errorMessage);
      if (this.session) {
        this.session.errors.push(errorMessage);
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check login result and detect errors/challenges
   */
  private async checkLoginResult(page: Page): Promise<{ success: boolean; error?: string }> {
    const currentUrl = page.url();
    const pageContent = await page.content();
    const pageText = await page.evaluate(() => document.body.innerText);

    // Success: on feed or home page
    if (currentUrl.includes('/feed') || currentUrl.includes('/mynetwork')) {
      return { success: true };
    }

    // Challenge/verification required
    if (
      currentUrl.includes('/challenge') ||
      currentUrl.includes('/checkpoint') ||
      pageText.includes('security verification') ||
      pageText.includes('verify your identity') ||
      pageText.includes('verify it\'s you')
    ) {
      return {
        success: false,
        error: 'Security verification required. Please log in manually first.',
      };
    }

    // CAPTCHA
    if (pageContent.includes('captcha') || pageContent.includes('recaptcha')) {
      return {
        success: false,
        error: 'CAPTCHA detected. Please log in manually first.',
      };
    }

    // Still on login page
    if (currentUrl.includes('/login') || currentUrl.includes('/uas/login')) {
      // Check for specific error messages
      if (pageText.includes('incorrect') || pageText.includes('wrong password')) {
        return { success: false, error: 'Incorrect email or password' };
      }
      if (pageText.includes('try again')) {
        return { success: false, error: 'Login attempt failed. Please try again later.' };
      }
      if (pageText.includes('temporarily restricted')) {
        return { success: false, error: 'Account temporarily restricted' };
      }

      return { success: false, error: 'Login failed - still on login page' };
    }

    // Account restricted
    if (currentUrl.includes('/restricted') || pageText.includes('restricted')) {
      return { success: false, error: 'Account is restricted' };
    }

    // Unknown state but not on login page
    console.log(`Unknown login state. URL: ${currentUrl}`);
    return { success: false, error: `Unknown login state: ${currentUrl}` };
  }

  /**
   * Check if currently logged in
   */
  async isCurrentlyLoggedIn(): Promise<boolean> {
    if (!this.page || this.page.isClosed()) {
      return false;
    }

    try {
      const currentUrl = this.page.url();
      return (
        currentUrl.includes('linkedin.com') &&
        !currentUrl.includes('/login') &&
        !currentUrl.includes('/uas/login')
      );
    } catch {
      return false;
    }
  }

  /**
   * Navigate to a LinkedIn page (with login check)
   */
  async navigateTo(url: string): Promise<{ success: boolean; error?: string }> {
    const page = await this.getPage();

    try {
      // Check if logged in
      if (!this.isLoggedIn) {
        const loginResult = await this.login();
        if (!loginResult.success) {
          return loginResult;
        }
      }

      console.log(`Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: browserConfig.navigationTimeout,
      });

      // Wait for page to stabilize
      await humanBehaviorService.randomSleep(
        humanBehaviorService.getPageLoadDelay(),
        humanBehaviorService.getPageLoadDelay() + 2000
      );

      // Update session
      if (this.session) {
        this.session.pagesVisited++;
        this.session.lastActivity = new Date();
      }

      // Check if redirected to login
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/uas/login')) {
        this.isLoggedIn = false;
        return { success: false, error: 'Session expired - redirected to login' };
      }

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Navigation failed';
      return { success: false, error: errorMessage };
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Get current session info
   */
  getSession(): BrowserSession | null {
    return this.session;
  }

  /**
   * Update session activity
   */
  recordActivity(): void {
    if (this.session) {
      this.session.actionsPerformed++;
      this.session.lastActivity = new Date();
    }
    humanBehaviorService.recordAction();
  }

  /**
   * Add warning to session
   */
  addWarning(warning: string): void {
    console.warn(`Session warning: ${warning}`);
    if (this.session) {
      this.session.warnings.push(warning);
      if (this.session.warnings.length >= 3) {
        this.session.status = 'warning';
      }
    }
  }

  /**
   * Check if session should be paused
   */
  shouldPauseSession(): boolean {
    if (!this.session) return false;

    // Pause if too many warnings
    if (this.session.warnings.length >= 5) {
      return true;
    }

    // Pause if session exceeded duration
    if (humanBehaviorService.shouldEndSession()) {
      return true;
    }

    return false;
  }

  /**
   * Get login status
   */
  getLoginStatus(): {
    isLoggedIn: boolean;
    attempts: number;
    lastAttempt: Date | null;
    canAttemptNow: boolean;
  } {
    const canLogin = this.canAttemptLogin();
    return {
      isLoggedIn: this.isLoggedIn,
      attempts: this.loginAttempts,
      lastAttempt: this.lastLoginAttempt,
      canAttemptNow: canLogin.canAttempt,
    };
  }
}

// Export singleton instance
export const linkedInAuthService = new LinkedInAuthService();
