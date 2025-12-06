import {
  loadGoldenConversations,
  loadReviewedGoldenConversations,
  getGoldenConversationStats,
} from '../index';

describe('Golden Conversations', () => {
  describe('Validation', () => {
    it('should load all golden conversations', () => {
      const conversations = loadGoldenConversations();
      expect(conversations.length).toBeGreaterThan(0);
    });

    it('should validate all conversations have required fields', () => {
      const conversations = loadGoldenConversations();

      conversations.forEach((conv) => {
        expect(conv.id).toBeDefined();
        expect(conv.metadata).toBeDefined();
        expect(conv.conversation).toBeDefined();
        expect(conv.caseData).toBeDefined();
        expect(conv.userContext).toBeDefined();
        expect(conv.expectedResponse).toBeDefined();
      });
    });

    it('should validate all conversations have at least 2 messages', () => {
      const conversations = loadGoldenConversations();

      conversations.forEach((conv) => {
        expect(conv.conversation.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should validate all intents are valid', () => {
      const conversations = loadGoldenConversations();
      const validIntents = ['donation', 'share', 'help', 'information', 'unknown'];

      conversations.forEach((conv) => {
        expect(validIntents).toContain(conv.metadata.intent);
      });
    });

    it('should validate all languages are valid', () => {
      const conversations = loadGoldenConversations();
      const validLanguages = ['es', 'en'];

      conversations.forEach((conv) => {
        expect(validLanguages).toContain(conv.metadata.language);
      });
    });

    it('should validate all have messages array', () => {
      const conversations = loadGoldenConversations();

      conversations.forEach((conv) => {
        expect(conv.expectedResponse.messages).toBeDefined();
        expect(conv.expectedResponse.messages.length).toBeGreaterThan(0);

        // Each message should have required fields
        conv.expectedResponse.messages.forEach((msg) => {
          expect(msg.message).toBeDefined();
          expect(typeof msg.message).toBe('string');
          expect(msg.message.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Coverage', () => {
    it('should have conversations for all intents', () => {
      const stats = getGoldenConversationStats();

      expect(stats.byIntent.donation).toBeGreaterThan(0);
      expect(stats.byIntent.share).toBeGreaterThan(0);
      expect(stats.byIntent.help).toBeGreaterThan(0);
      expect(stats.byIntent.information).toBeGreaterThan(0);
    });

    it('should have conversations in both languages', () => {
      const stats = getGoldenConversationStats();

      expect(stats.byLanguage.es).toBeGreaterThan(0);
      expect(stats.byLanguage.en).toBeGreaterThan(0);
    });

    it('should have conversations of varying complexity', () => {
      const stats = getGoldenConversationStats();

      expect(stats.byComplexity.simple).toBeGreaterThan(0);
      expect(stats.byComplexity.medium).toBeGreaterThan(0);
    });

    it('should have at least 50 total conversations', () => {
      const stats = getGoldenConversationStats();
      expect(stats.total).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Review Status', () => {
    it('should track review status', () => {
      const stats = getGoldenConversationStats();

      expect(stats.total).toBeGreaterThanOrEqual(stats.reviewed);
      expect(stats.pending).toBe(stats.total - stats.reviewed);
    });
  });
});

