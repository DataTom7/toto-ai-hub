# Gemini Code Assist Integration Guide

## Executive Summary

This document provides guidance on using **Gemini Code Assist** to accelerate development on TotoAI Hub. Code Assist provides AI-powered code completion, generation, and explanation capabilities integrated directly into your IDE.

**Status**: 📚 Documentation & Best Practices
**Priority**: Low (Developer Productivity Enhancement)
**Cost**: Free tier available, paid tiers for advanced features
**Setup Time**: 15-30 minutes

---

## What is Gemini Code Assist?

**Gemini Code Assist** (formerly Duet AI) is Google Cloud's AI-powered coding assistant that provides:

- **Code Completion**: Context-aware suggestions as you type
- **Code Generation**: Generate entire functions, classes, or files from natural language
- **Code Explanation**: Understand complex code with AI-generated explanations
- **Code Chat**: Ask questions about your codebase
- **Test Generation**: Automatically generate unit tests
- **Documentation**: Generate docstrings and comments
- **Code Review**: Get AI suggestions for code improvements
- **Debugging**: Get help understanding and fixing errors

**Powered by**: Gemini 2.0 Pro (optimized for code)

---

## Why Use Code Assist for TotoAI Hub?

### Current Development Challenges
1. Complex agent architecture with multiple services
2. Large prompt system requiring careful maintenance
3. TypeScript types across many files
4. Firebase Firestore query patterns
5. Google Generative AI SDK integration
6. RAG and vector search implementations

### How Code Assist Helps

| Task | Without Code Assist | With Code Assist | Time Saved |
|------|-------------------|-----------------|------------|
| Write new agent method | 15-20 min | 5-8 min | ~60% |
| Generate unit tests | 20-30 min | 5-10 min | ~70% |
| Understand complex code | 10-15 min | 2-3 min | ~80% |
| Write prompt components | 10-15 min | 3-5 min | ~65% |
| Debug TypeScript errors | 5-10 min | 2-3 min | ~60% |
| Write Firestore queries | 8-12 min | 3-5 min | ~65% |

**Average Productivity Gain**: ~60-70%

---

## Setup Instructions

### Option 1: VS Code (Recommended)

1. **Install Extension**
   ```bash
   # Install from VS Code Marketplace
   code --install-extension GoogleCloudTools.cloudcode
   ```

2. **Sign in to Google Cloud**
   - Open VS Code
   - Click "Cloud Code" in status bar
   - Select "Sign In"
   - Choose your Google account with GCP access

3. **Configure Project**
   - Open Command Palette (Cmd/Ctrl + Shift + P)
   - Type "Cloud Code: Select Project"
   - Choose your TotoAI Hub GCP project

4. **Enable Code Assist**
   - Settings → Extensions → Cloud Code
   - Check "Enable Code Suggestions"
   - Select "Gemini Code Assist" as provider

### Option 2: JetBrains IDEs (WebStorm, IntelliJ)

1. **Install Plugin**
   - Settings → Plugins
   - Search "Cloud Code"
   - Install and restart

2. **Authenticate**
   - Tools → Cloud Code → Sign In
   - Follow OAuth flow

3. **Configure**
   - Settings → Tools → Cloud Code
   - Enable "Gemini Code Assist"

### Option 3: Cloud Shell Editor

Gemini Code Assist is automatically available in Cloud Shell Editor (no setup required).

### Verify Installation

```typescript
// Type this comment and wait for suggestion:
// Function to analyze a tweet and detect if it's a case update

// Code Assist should suggest a complete function implementation
```

---

## Usage Guide for TotoAI Hub

### 1. Generate Agent Methods

**Prompt**:
```typescript
// Generate a method for CaseAgent that checks if a case requires urgent attention
// based on medical keywords and funding status
```

**Expected Output**:
```typescript
async checkUrgency(caseId: string): Promise<{
  isUrgent: boolean;
  reason: string;
  recommendedActions: string[];
}> {
  const caseData = await this.getCaseData(caseId);

  // Check medical urgency keywords
  const urgentKeywords = ['emergency', 'critical', 'urgent', 'immediate'];
  const hasMedicalUrgency = urgentKeywords.some(keyword =>
    caseData.description.toLowerCase().includes(keyword)
  );

  // Check funding status
  const fundingProgress = caseData.fundsRaised / caseData.fundingGoal;
  const hasLowFunding = fundingProgress < 0.3;

  if (hasMedicalUrgency && hasLowFunding) {
    return {
      isUrgent: true,
      reason: 'Critical medical case with low funding',
      recommendedActions: [
        'Notify guardians immediately',
        'Create urgent donation campaign',
        'Contact emergency veterinary services'
      ]
    };
  }

  return { isUrgent: false, reason: 'Case status normal', recommendedActions: [] };
}
```

### 2. Generate Prompt Components

**Prompt**:
```typescript
// Create a prompt component for detecting animal species in Instagram posts
```

**Expected Output**:
```typescript
export const speciesDetectionGuidelines = `
🐾 SPECIES DETECTION GUIDELINES:

When analyzing posts about animals, identify:
1. **Primary Species**: Dog, cat, bird, rabbit, etc.
2. **Breed Information**: If mentioned or visually identifiable
3. **Species-Specific Needs**: Consider species-specific medical needs
4. **Multiple Animals**: Note if post involves multiple species

Always prioritize accuracy. If unsure about species, use "Unknown" rather than guessing.

Example:
- "Golden Retriever puppy" → Species: Dog, Breed: Golden Retriever
- "Orange tabby cat" → Species: Cat, Breed: Domestic Shorthair
- "Small animal" → Species: Unknown (insufficient information)
`;
```

### 3. Generate Unit Tests

**Prompt**:
```typescript
// Generate comprehensive unit tests for SemanticCachingService
```

**Expected Output**:
```typescript
import { SemanticCachingService } from '../SemanticCachingService';

describe('SemanticCachingService', () => {
  let service: SemanticCachingService;

  beforeEach(() => {
    service = new SemanticCachingService();
  });

  afterEach(() => {
    service.clear();
  });

  describe('get()', () => {
    it('should return null for cache miss', async () => {
      const result = await service.get('new query');
      expect(result).toBeNull();
    });

    it('should return cached response for exact match', async () => {
      await service.set('hello world', 'response 1');
      const result = await service.get('hello world');
      expect(result).toBe('response 1');
    });

    it('should return cached response for similar query', async () => {
      await service.set('how to help rescue dogs', 'response 1');
      const result = await service.get('ways to help rescue dogs');
      expect(result).toBe('response 1');
    });

    it('should not return cached response for dissimilar query', async () => {
      await service.set('dog rescue', 'response 1');
      const result = await service.get('cat adoption');
      expect(result).toBeNull();
    });
  });

  describe('set()', () => {
    it('should cache a query-response pair', async () => {
      await service.set('test query', 'test response');
      const result = await service.get('test query');
      expect(result).toBe('test response');
    });

    it('should evict oldest entry when cache is full', async () => {
      // Fill cache to max size
      for (let i = 0; i < 1001; i++) {
        await service.set(`query ${i}`, `response ${i}`);
      }

      // First entry should be evicted
      const result = await service.get('query 0');
      expect(result).toBeNull();
    });
  });

  describe('getStats()', () => {
    it('should track cache hits and misses', async () => {
      await service.set('query', 'response');
      await service.get('query');  // hit
      await service.get('unknown');  // miss

      const stats = service.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });
});
```

### 4. Explain Complex Code

**How to Use**:
1. Select code block
2. Right-click → "Code Assist: Explain This"
3. Read AI-generated explanation

**Example - Explain VectorDBService's cosineSimilarity**:
```typescript
// Selected code:
private cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// AI Explanation:
/**
 * This method calculates the cosine similarity between two embedding vectors.
 *
 * Cosine similarity measures the angle between two vectors in multi-dimensional
 * space, producing a value between -1 (opposite) and 1 (identical).
 *
 * Steps:
 * 1. Calculate dot product: sum of element-wise multiplication
 * 2. Calculate magnitude of vector A: sqrt of sum of squares
 * 3. Calculate magnitude of vector B: sqrt of sum of squares
 * 4. Divide dot product by product of magnitudes
 *
 * In RAG systems, cosine similarity is preferred over Euclidean distance
 * because it's invariant to vector magnitude - only direction matters.
 *
 * Example:
 * A = [1, 2, 3], B = [2, 4, 6]  // B is 2x A
 * Similarity = 1.0 (perfectly similar, same direction)
 */
```

### 5. Generate Firestore Queries

**Prompt**:
```typescript
// Generate a Firestore query to get all cases with urgency level "critical"
// that were created in the last 7 days, ordered by creation date
```

**Expected Output**:
```typescript
async getCriticalRecentCases(days: number = 7): Promise<CaseData[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const casesRef = this.db.collection('cases');
  const snapshot = await casesRef
    .where('urgencyLevel', '==', 'critical')
    .where('createdAt', '>=', cutoffDate)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as CaseData));
}
```

### 6. Generate Documentation

**Prompt**:
```typescript
// Generate comprehensive JSDoc for StreamingService.streamWithRetry
```

**Expected Output**:
```typescript
/**
 * Streams a response from Gemini with automatic retry on interruption.
 *
 * This method wraps `streamResponse()` with retry logic to handle transient
 * failures such as network interruptions, rate limiting, or temporary API issues.
 *
 * @param prompt - The prompt to send to the AI model
 * @param options - Streaming options including callbacks and generation config
 * @param maxRetries - Maximum number of retry attempts (default: 2)
 *
 * @returns {Promise<StreamResult>} Result containing:
 *   - fullText: Complete generated text
 *   - chunks: Array of stream chunks received
 *   - duration: Total time in milliseconds
 *   - tokenCount: Estimated token count
 *   - interrupted: Whether stream was interrupted
 *
 * @throws {Error} If all retry attempts fail
 *
 * @example
 * ```typescript
 * const result = await streamingService.streamWithRetry(
 *   'Explain quantum computing',
 *   {
 *     onChunk: (chunk) => console.log(chunk.text),
 *     temperature: 0.7
 *   },
 *   maxRetries: 3
 * );
 * console.log(`Generated ${result.tokenCount} tokens in ${result.duration}ms`);
 * ```
 *
 * @remarks
 * - Uses exponential backoff between retries (1s, 2s, 4s, ...)
 * - Returns partial result if interrupted after max retries
 * - Callbacks are invoked for each retry attempt
 * - Analytics are updated even on retry
 *
 * @see streamResponse For single-attempt streaming
 * @see streamWithFallback For streaming with non-streaming fallback
 */
async streamWithRetry(
  prompt: string,
  options: StreamOptions = {},
  maxRetries: number = 2
): Promise<StreamResult> {
  // Implementation...
}
```

---

## Best Practices for TotoAI Hub

### 1. Use Descriptive Comments

**❌ Bad**:
```typescript
// Process tweet
```

**✅ Good**:
```typescript
// Analyze tweet content for case relevance, extract key information (animal type,
// medical condition, urgency level), and determine if it should create a new case
// or update an existing one based on duplicate detection
```

Better prompts → Better AI suggestions.

### 2. Leverage Context

Code Assist understands your entire file and related files. Reference existing patterns:

```typescript
// Generate a method similar to TwitterAgent.analyzeTweet but for Instagram Stories
```

### 3. Iterate with AI

**Workflow**:
1. Generate initial code with Code Assist
2. Review and test
3. Add comment: "Improve error handling and add logging"
4. Accept enhanced suggestions
5. Add comment: "Add TypeScript types and JSDoc"
6. Accept final version

### 4. Use for Repetitive Tasks

**Examples**:
- Generate interfaces from JSON data
- Create CRUD methods for new Firestore collections
- Generate test fixtures and mock data
- Create similar methods with variations

### 5. Combine with Existing Code

```typescript
// Generate a builder pattern similar to PromptBuilder but for constructing
// Firestore queries with method chaining and type safety
```

Code Assist will study `PromptBuilder.ts` and create a similar pattern.

---

## Common Use Cases

### Use Case 1: Add New Agent

**Goal**: Create a new `FacebookAgent` similar to `TwitterAgent`

**Steps**:
1. Open `src/agents/TwitterAgent.ts`
2. Create new file `src/agents/FacebookAgent.ts`
3. Add comment:
   ```typescript
   // Create FacebookAgent class similar to TwitterAgent but optimized for
   // Facebook posts and groups, using FacebookPost interface instead of Tweet
   ```
4. Code Assist generates entire agent structure
5. Review and customize for Facebook-specific features

**Time**: ~10 minutes (vs ~30 minutes manual)

### Use Case 2: Add New RAG Knowledge Category

**Goal**: Add "Training Resources" knowledge category

**Steps**:
1. Open `src/services/RAGService.ts`
2. Add comment:
   ```typescript
   // Add methods to manage "training" knowledge category including
   // addTrainingResource, getTrainingRecommendations, and searchTraining
   ```
3. Accept generated methods
4. Generate tests with:
   ```typescript
   // Generate unit tests for new training resource methods
   ```

**Time**: ~5 minutes (vs ~20 minutes manual)

### Use Case 3: Refactor for Performance

**Goal**: Optimize `VectorDBService.search()` for large datasets

**Steps**:
1. Select `search()` method
2. Ask Code Assist: "How can I optimize this method for 1M+ documents?"
3. Review suggestions (batch processing, caching, indexing)
4. Ask: "Implement these optimizations with backward compatibility"
5. Review and test generated code

**Time**: ~15 minutes (vs ~1 hour manual)

### Use Case 4: Add Telemetry

**Goal**: Add OpenTelemetry tracing to all agents

**Steps**:
1. Add comment at top of `CaseAgent.ts`:
   ```typescript
   // Add OpenTelemetry tracing to all public methods with span attributes
   // for agent type, operation, and duration
   ```
2. Accept generated imports and tracer setup
3. Let Code Assist add tracing to each method
4. Repeat for other agents

**Time**: ~10 minutes per agent (vs ~30 minutes manual)

---

## Limitations & Caveats

### What Code Assist Does Well
✅ Boilerplate code generation
✅ TypeScript type definitions
✅ Unit test scaffolding
✅ Documentation and comments
✅ Code patterns and structure
✅ Firestore query syntax
✅ Google SDK usage

### What Requires Human Review
⚠️ Business logic and requirements
⚠️ Security and authentication
⚠️ Complex algorithms
⚠️ Performance optimization decisions
⚠️ Prompt engineering specifics
⚠️ Cost/quota management
⚠️ Edge cases and error scenarios

### Best Practices
1. **Always review generated code** - Don't blindly accept
2. **Test thoroughly** - AI can introduce subtle bugs
3. **Verify security** - Check for hardcoded credentials, SQL injection, etc.
4. **Check types** - Ensure TypeScript types are correct
5. **Validate logic** - Ensure business rules are correctly implemented
6. **Review prompts** - AI-generated prompts may need fine-tuning

---

## Advanced Features

### 1. Chat with Your Codebase

**How to Use**:
1. Open Code Assist Chat panel
2. Ask questions like:
   - "Where is case urgency calculated?"
   - "How does duplicate detection work in TwitterAgent?"
   - "What's the difference between RAGService and VectorDBService?"

**Benefits**:
- Faster onboarding for new developers
- Quick architecture understanding
- Find code across large codebase

### 2. Code Transformations

**Examples**:
- "Convert this class to use async/await instead of promises"
- "Refactor this code to use TypeScript generics"
- "Split this large method into smaller helper methods"

### 3. Migration Assistance

**Example - ES5 to ES6**:
```typescript
// Select old code:
var self = this;
getData(function(err, data) {
  if (err) {
    return callback(err);
  }
  self.processData(data);
});

// Ask: "Convert to async/await"
// Result:
try {
  const data = await getData();
  await this.processData(data);
} catch (err) {
  throw err;
}
```

### 4. Security Scanning

Ask Code Assist:
- "Are there any security issues in this code?"
- "Check for SQL injection vulnerabilities"
- "Review authentication logic for issues"

### 5. Performance Analysis

Ask Code Assist:
- "Is this code optimized for performance?"
- "Where are the performance bottlenecks?"
- "Suggest caching strategies"

---

## Cost & Licensing

### Free Tier (Individual)
- ✅ Code completion in IDE
- ✅ Basic code generation
- ✅ Code explanation
- ✅ 500 suggestions/month
- ❌ Chat with codebase
- ❌ Advanced features

### Paid Tier (Team)
- ✅ Everything in Free tier
- ✅ Chat with entire codebase
- ✅ Unlimited suggestions
- ✅ Custom model fine-tuning
- ✅ Team collaboration features
- ✅ Priority support
- **Cost**: $19/user/month

### Enterprise Tier
- ✅ Everything in Paid tier
- ✅ SLA and dedicated support
- ✅ Advanced security controls
- ✅ Audit logging
- ✅ Custom integrations
- **Cost**: Custom pricing

**Recommendation for TotoAI Hub**: Start with **Free tier** for individual developers, upgrade to **Paid tier** if productivity gains justify the cost (typical ROI: 5-10x).

---

## Metrics & ROI

### Productivity Metrics (Expected)

| Metric | Without Code Assist | With Code Assist | Improvement |
|--------|-------------------|-----------------|-------------|
| New feature development | 2-3 days | 1-2 days | 40-50% faster |
| Bug fixing | 2-4 hours | 1-2 hours | 50% faster |
| Test writing | 30% of dev time | 15% of dev time | 50% reduction |
| Code review time | 1-2 hours | 30-60 min | 50% faster |
| Onboarding new developers | 2-3 weeks | 1-2 weeks | 40% faster |

### ROI Calculation

**Investment**:
- Setup time: 2 hours (one-time)
- Learning curve: 4 hours (one-time)
- Monthly cost: $0-19/user

**Returns (per developer)**:
- Time saved: ~8-10 hours/week
- Value: 8 hours × $50/hour × 4 weeks = **$1,600/month**
- Cost: $19/month
- **ROI**: ~8,300% 🚀

*Even with just 2 hours/week savings, ROI is positive*

---

## Getting Started Checklist

### Week 1: Setup & Familiarization
- [ ] Install Code Assist extension
- [ ] Authenticate with GCP
- [ ] Test with simple code completion
- [ ] Try generating a small function
- [ ] Use "Explain This" on existing code
- [ ] Review generated suggestions critically

### Week 2: Productivity Boost
- [ ] Use for new agent method development
- [ ] Generate unit tests for new code
- [ ] Try chat feature to understand codebase
- [ ] Use for documentation generation
- [ ] Refactor old code with assistance

### Week 3: Advanced Usage
- [ ] Use for complex features (RAG, Vector Search)
- [ ] Try code transformations
- [ ] Leverage for debugging
- [ ] Use for performance optimization
- [ ] Train team on best practices

### Week 4: Measure & Optimize
- [ ] Track time savings
- [ ] Measure code quality (test coverage, bugs)
- [ ] Gather team feedback
- [ ] Adjust workflows based on learnings
- [ ] Document team best practices

---

## Troubleshooting

### Issue: No Suggestions Appearing

**Causes**:
1. Code Assist not enabled
2. Not authenticated
3. File type not supported
4. Suggestions disabled for file

**Solutions**:
1. Check Settings → Extensions → Cloud Code
2. Re-authenticate (Cloud Code: Sign In)
3. Ensure file is `.ts`, `.js`, `.tsx`
4. Check `.gitignore` and `.cloudcodeignore`

### Issue: Poor Quality Suggestions

**Causes**:
1. Unclear/vague comments
2. Missing context
3. Non-standard code patterns

**Solutions**:
1. Write more detailed comments
2. Ensure related files are open
3. Follow TypeScript best practices
4. Provide examples in comments

### Issue: Slow Performance

**Causes**:
1. Large project size
2. Network latency
3. High CPU usage

**Solutions**:
1. Exclude `node_modules/` from indexing
2. Check internet connection
3. Close unused files/applications

---

## Resources

### Documentation
- [Gemini Code Assist Overview](https://cloud.google.com/gemini/docs/code-assist/overview)
- [VS Code Setup Guide](https://cloud.google.com/code/docs/vscode/install)
- [Best Practices](https://cloud.google.com/gemini/docs/code-assist/best-practices)

### Videos
- [Getting Started with Code Assist (YouTube)](https://www.youtube.com/watch?v=...)
- [Advanced Features Tutorial](https://www.youtube.com/watch?v=...)

### Support
- [Code Assist Support](https://cloud.google.com/support)
- [Community Forums](https://www.googlecloudcommunity.com/)

---

## Conclusion

**Gemini Code Assist is a powerful productivity multiplier** for TotoAI Hub development. By automating boilerplate code, generating tests, and explaining complex logic, it can save 8-10 hours per week per developer.

**Key Takeaways**:
1. ✅ Easy setup (15-30 minutes)
2. ✅ Significant time savings (40-70% on repetitive tasks)
3. ✅ Excellent ROI even with free tier
4. ✅ Best for: boilerplate, tests, docs, exploration
5. ⚠️ Always review AI-generated code
6. ⚠️ Not a replacement for human judgment

**Recommendation**: **Adopt immediately** for individual developers, evaluate team license after 30 days based on measured productivity gains.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-06
**Next Review**: After 30 days of usage
