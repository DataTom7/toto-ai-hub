# toto-ai-hub API Reference

Complete API documentation for toto-ai-hub services.

## Table of Contents

- [TotoAPIGateway](#totoapi-gateway)
- [CaseAgent](#caseagent)
- [RAGService](#ragservice)
- [VectorDBService](#vectordbservice)
- [MetricsService](#metricsservice)
- [RateLimitService](#ratelimitservice)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## TotoAPIGateway

Main entry point for interacting with toto-ai-hub. Provides a simplified, high-level API for case inquiry processing.

### `processCaseInquiry()`

Process a user message about a case with automatic intent detection, knowledge retrieval, and response generation.

**Method Signature:**
```typescript
// Access via TotoAI instance
const gateway = new TotoAPIGateway(sharedKbFirestore);
await gateway.initialize();
const totoAI = gateway.getTotoAI();

// Process case inquiry
const response = await totoAI.processCaseMessage(
  message: string,
  caseData: CaseData,
  userContext: UserContext,
  conversationContext?: ConversationContext
): Promise<CaseResponse>
```

**Parameters:**

```typescript
interface CaseData {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'urgent' | 'completed';
  priority: 'urgent' | 'normal';
  category: 'rescue' | 'surgery' | 'treatment' | 'transit' | 'foster';
  guardianId: string;
  donationsReceived: number;
  imageUrl?: string;
  location?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  // ... additional fields
}

interface UserContext {
  userId: string;
  userRole: 'user' | 'guardian' | 'admin' | 'investor' | 'lead_investor' | 'partner';
  language: 'es' | 'en';
  location?: string;
  preferences?: {
    notifications: boolean;
    communicationStyle: 'formal' | 'casual';
  };
}

interface ConversationContext {
  conversationId?: string;
  previousMessages?: Array<{
    role: 'user' | 'agent';
    message: string;
    timestamp?: string;
  }>;
  metadata?: Record<string, any>;
}
```

**Returns:**

```typescript
interface CaseResponse {
  success: boolean;
  message: string;
  caseData?: CaseData;
  suggestions?: string[];
  metadata?: {
    intent?: 'donation' | 'share' | 'help' | 'information' | 'unknown';
    confidence?: number;
    suggestedActions?: Array<{
      type: 'donation' | 'share' | 'contact' | 'navigation';
      label: string;
      data?: any;
    }>;
    kbSources?: Array<{
      content: string;
      metadata: Record<string, any>;
    }>;
  };
  error?: string;
  conversationId?: string;
}
```

**Usage Example:**

```typescript
import { TotoAPIGateway } from 'toto-ai-hub';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Create gateway instance
const gateway = new TotoAPIGateway(
  admin.firestore() // Share Firestore instance
);

// Initialize (loads KB, syncs to Vertex AI)
await gateway.initialize();

// Process a donation inquiry
const totoAI = gateway.getTotoAI();
const response = await totoAI.processCaseMessage(
  'Quiero donar $1000',
  {
    id: 'case-123',
    name: 'Luna - Rescue',
    description: 'Luna needs urgent surgery',
    status: 'active',
    priority: 'urgent',
    category: 'rescue',
    guardianId: 'guardian-456',
    donationsReceived: 5000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    userId: 'user-789',
    userRole: 'user',
    language: 'es',
  }
);

console.log(response.message);
// "¡Gracias por tu interés en ayudar a Luna! Para donar $1.000..."

console.log(response.metadata?.intent); // 'donation'
console.log(response.metadata?.suggestedActions);
// [{ type: 'donation', label: 'Donar $1.000', data: { amount: 1000 } }]
```

**Error Handling:**

```typescript
try {
  const response = await totoAI.processCaseMessage(
    userMessage,
    caseData,
    userContext
  );

  if (!response.success) {
    if (response.error === 'RATE_LIMIT_EXCEEDED') {
      // Handle rate limit
      console.error('Too many requests. Please try again later.');
    } else if (response.error === 'VALIDATION_ERROR') {
      // Handle validation error
      console.error('Invalid input:', response.message);
    } else {
      // Handle other errors
      console.error('Error:', response.error);
    }
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

### `getMetrics()`

Get system metrics for monitoring.

**Method Signature:**
```typescript
getMetrics(): Record<string, any>
```

**Returns:**
```typescript
{
  summary: Record<string, any>;
  performance: {
    responseTime?: MetricStats;
    vectorSearch?: MetricStats;
    embedding?: MetricStats;
  };
  cache: {
    intentCache?: MetricStats;
    vectorSearchCache?: MetricStats;
  };
  costs: Record<string, number>;
  quality: Record<string, number>;
  errors: Record<string, number>;
}
```

**Usage Example:**

```typescript
const metrics = gateway.getMetrics();

console.log('Vertex AI calls:', metrics.costs.vertex_ai_calls);
console.log('Avg response time:', metrics.performance.responseTime?.avg);
console.log('Cache hit rate:', metrics.cache.intentCache);
```

### `getTotoAI()`

Get the underlying TotoAI instance for direct agent access.

**Method Signature:**
```typescript
getTotoAI(): TotoAI
```

**Usage Example:**

```typescript
const totoAI = gateway.getTotoAI();
const caseAgent = totoAI.getCaseAgent();
const response = await caseAgent.processCaseInquiry(/* ... */);
```

---

## CaseAgent

Advanced agent for case inquiry processing with intent detection, conversation management, and context-aware responses.

### `processCaseInquiry()`

Lower-level method with more control over the processing pipeline.

**Method Signature:**
```typescript
async processCaseInquiry(
  message: string,
  caseData: CaseData,
  context: UserContext,
  conversationContext?: ConversationContext
): Promise<CaseResponse>
```

**Intent Detection:**

The CaseAgent automatically detects user intent from messages:

| Intent      | Examples                                   | Response Strategy |
|-------------|--------------------------------------------|-------------------|
| donation    | "Quiero donar", "$1000", "Donar 500 pesos" | Provide donation instructions, banking alias, amount confirmation |
| share       | "Compartir", "Quiero ayudar difundiendo"   | Generate shareable message with case details |
| help        | "¿Cómo puedo ayudar?", "Ayuda"              | Show available actions (donate, share, contact) |
| information | "¿Qué necesita?", "Cuéntame más"          | Provide detailed case information from KB |
| unknown     | Ambiguous or off-topic                     | Ask for clarification, suggest available actions |

**Context Awareness:**

The agent maintains conversation context to provide coherent multi-turn conversations:

```typescript
// First message
const response1 = await agent.processCaseInquiry(
  'Quiero donar',
  caseData,
  { userId: 'user-1', userRole: 'user', language: 'es' }
);
// Response: "¿Qué monto te gustaría donar?"

// Second message (remembers context)
const response2 = await agent.processCaseInquiry(
  '$1000',
  caseData,
  { userId: 'user-1', userRole: 'user', language: 'es' },
  { conversationId: response1.conversationId }
);
// Response: "Perfecto! Para donar $1.000 a Luna..."
```

**Method: `setRAGService(ragService: RAGService)`**

Configure the RAG service for knowledge retrieval.

```typescript
import { CaseAgent } from 'toto-ai-hub/agents';
import { RAGService } from 'toto-ai-hub/services';
import { VertexAISearchService } from 'toto-ai-hub/services';

const vertexAI = new VertexAISearchService();
const ragService = new RAGService(vertexAI);
const agent = new CaseAgent();

agent.setRAGService(ragService);
```

---

## RAGService

Service for generating embeddings and retrieving knowledge from the vector database.

### `generateEmbedding()`

Generate a 768-dimensional embedding vector for text.

**Method Signature:**
```typescript
async generateEmbedding(
  text: string,
  context?: { userId?: string; userRole?: string }
): Promise<number[]>
```

**Parameters:**
- `text` (string): Text to embed (max 5000 characters)
- `context` (optional): User context for rate limiting

**Returns:**
- `number[]`: 768-dimensional embedding vector

**Features:**
- Automatic caching (24-hour TTL)
- Fallback to local embeddings if Vertex AI unavailable
- Input validation and sanitization
- Retry logic with exponential backoff

**Usage Example:**

```typescript
import { RAGService } from 'toto-ai-hub/services';

const ragService = new RAGService(vertexAIService);

const embedding = await ragService.generateEmbedding(
  'Luna necesita cirugía urgente'
);

console.log(embedding.length); // 768
```

### `retrieveKnowledge()`

Retrieve relevant knowledge entries from the vector database.

**Method Signature:**
```typescript
async retrieveKnowledge(params: {
  query: string;
  category?: string;
  audience?: string | string[];
  topK?: number;
}): Promise<KnowledgeChunk[]>
```

**Parameters:**

```typescript
interface KnowledgeRetrievalParams {
  query: string;           // Search query
  category?: string;       // Filter by category ('rescue', 'surgery', etc.)
  audience?: string | string[]; // Filter by audience ('donors', 'guardians', etc.)
  topK?: number;          // Number of results (default: 3)
}
```

**Returns:**
- Array of knowledge entries with content, similarity score, and metadata

**Usage Example:**

```typescript
const results = await ragService.retrieveKnowledge({
  query: '¿Cómo funciona el proceso de donación?',
  category: 'rescue',
  audience: 'donors',
  topK: 3,
});

results.forEach(result => {
  console.log(`Content: ${result.content}`);
  console.log(`Category: ${result.category}`);
  console.log(`Audience: ${result.audience}`);
});
```

### `addKnowledgeChunks()`

Add knowledge chunks to the vector database.

**Method Signature:**
```typescript
async addKnowledgeChunks(
  chunks: KnowledgeChunk[],
  knowledgeBaseService?: KnowledgeBaseService
): Promise<void>
```

**Usage Example:**

```typescript
await ragService.addKnowledgeChunks([
  {
    id: 'kb-1',
    title: 'Donation Process',
    content: 'El proceso de donación es simple: 1) Elegir monto, 2) Transferir al alias bancario, 3) Enviar comprobante',
    category: 'rescue',
    agentTypes: ['CaseAgent'],
    audience: ['donors'],
    lastUpdated: new Date().toISOString(),
    usageCount: 0,
  },
]);
```

---

## VectorDBService

High-performance vector database using HNSW (Hierarchical Navigable Small World) algorithm for O(log n) similarity search.

### `search()`

Search for similar vectors in the database.

**Method Signature:**
```typescript
async search(query: VectorSearchQuery): Promise<VectorSearchResult[]>
```

**Parameters:**

```typescript
interface VectorSearchQuery {
  embedding: number[];      // Query vector (768 dimensions)
  topK?: number;           // Number of results (default: 5)
  minScore?: number;       // Minimum similarity score (default: 0.7)
  filters?: {
    category?: string;     // Filter by category
    audience?: string;     // Filter by audience
    metadata?: Record<string, any>; // Additional metadata filters
  };
}

interface VectorSearchResult {
  document: VectorDocument;
  score: number;          // Cosine similarity (0-1)
  distance: number;        // Distance metric
}

interface VectorDocument {
  id: string;
  embedding: number[];
  content: string;
  metadata: VectorDocumentMetadata;
}

interface VectorDocumentMetadata {
  category: string;
  audience: string[];
  source: string;
  timestamp: Date;
  version?: string;
  [key: string]: any;
}
```

**Usage Example:**

```typescript
import { VectorDBService } from 'toto-ai-hub/services';

const vectorDB = new VectorDBService({
  backend: 'in-memory',
  dimensions: 768,
});

// Search for similar documents
const results = await vectorDB.search({
  embedding: queryEmbedding,
  topK: 5,
  minScore: 0.8,
  filters: {
    category: 'rescue',
    audience: 'donors',
  },
});

// Results are ordered by similarity score (highest first)
results.forEach((result, index) => {
  console.log(`Result ${index + 1}:`);
  console.log(`  Score: ${result.score.toFixed(3)}`);
  console.log(`  Content: ${result.document.content}`);
  console.log(`  Category: ${result.document.metadata.category}`);
});
```

**Performance Characteristics:**

- Search Complexity: O(log n) using HNSW algorithm
- Index Build: O(n log n)
- Memory Usage: ~3.5KB per document (768 floats + metadata)
- Typical Search Time: <10ms for 10,000 documents

### `upsertBatch()`

Efficiently add or update multiple documents.

**Method Signature:**
```typescript
async upsertBatch(
  documents: VectorDocument[]
): Promise<{
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors?: Array<{ id: string; error: string }>;
}>
```

**Example:**

```typescript
const result = await vectorDB.upsertBatch([
  {
    id: 'kb-1',
    embedding: embedding1,
    content: 'Donation instructions...',
    metadata: {
      category: 'rescue',
      audience: ['donors'],
      source: 'donation_guide',
      timestamp: new Date(),
      version: '1.0',
    },
  },
  {
    id: 'kb-2',
    embedding: embedding2,
    content: 'Adoption process...',
    metadata: {
      category: 'adoption',
      audience: ['adopters'],
      source: 'adoption_guide',
      timestamp: new Date(),
      version: '1.0',
    },
  },
]);

console.log(`Processed: ${result.processedCount}, Failed: ${result.failedCount}`);
```

---

## MetricsService

Production monitoring and metrics.

### Methods

#### `recordCounter()`

Record counter metric (increment).

```typescript
recordCounter(
  name: string,
  category: MetricCategory,
  value?: number,
  tags?: Record<string, string>
): void
```

**Example:**

```typescript
import { getMetricsService, MetricCategory } from 'toto-ai-hub/services';

const metrics = getMetricsService();

metrics.recordCounter(
  'vertex_ai_calls',
  MetricCategory.COST,
  1,
  { operation: 'embedding', success: 'true' }
);
```

#### `startTimer()`

Start duration timer.

```typescript
startTimer(
  name: string,
  category: MetricCategory,
  tags?: Record<string, string>
): () => void
```

**Example:**

```typescript
const stopTimer = metrics.startTimer(
  'process_message',
  MetricCategory.PERFORMANCE
);

// ... do work ...

stopTimer(); // Automatically records duration
```

#### `getStats()`

Get aggregated statistics for a metric.

```typescript
getStats(
  name: string,
  category?: MetricCategory
): MetricStats | null
```

**Returns:**
```typescript
interface MetricStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50?: number; // Median
  p95?: number;
  p99?: number;
}
```

#### `getSummary()`

Get all metrics summary by category.

```typescript
getSummary(): Record<string, any>
```

---

## RateLimitService

Multi-tier rate limiting.

### Methods

#### `checkLimit()`

Check rate limit for request.

```typescript
checkLimit(
  context: RateLimitContext,
  tier?: RateLimitTier
): void
```

**Parameters:**

```typescript
interface RateLimitContext {
  userId?: string;
  userRole?: 'user' | 'guardian' | 'admin' | 'investor' | 'lead_investor' | 'partner';
  ipAddress?: string;
}
```

**Throws:** `RateLimitError` if limit exceeded

**Example:**

```typescript
import { getRateLimitService } from 'toto-ai-hub/services';
import { RateLimitError } from 'toto-ai-hub/errors';

try {
  const rateLimitService = getRateLimitService();
  rateLimitService.checkLimit({
    userId: 'user-123',
    userRole: 'user',
    ipAddress: '192.168.1.1',
  });

  // Proceed with request
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfterMs}ms`);
  }
}
```

**Rate Limits:**

| Tier          | Limit           | Window |
|---------------|-----------------|--------|
| User          | 100 requests    | 1 hour |
| Admin         | 1000 requests   | 1 hour |
| IP            | 300 requests    | 1 hour |
| Global        | 10,000 requests | 1 hour |
| Expensive Ops | 50 requests     | 1 hour |

---

## Error Handling

All services use structured error handling:

```typescript
import { AppError, ErrorCategory } from 'toto-ai-hub/errors';

try {
  await gateway.getTotoAI().processCaseMessage(/* ... */);
} catch (error) {
  if (error instanceof AppError) {
    console.error('Category:', error.category);
    console.error('Retryable:', error.isRetryable);
    console.error('Status Code:', error.statusCode);
    console.error('User Message (ES):', error.getUserMessage('es'));
    console.error('Context:', error.context);
  }
}
```

**Error Categories:**

- `VALIDATION` - Invalid input (400, not retryable)
- `EXTERNAL_API` - API failures (502, retryable)
- `DATABASE` - Firestore errors (503, retryable)
- `TIMEOUT` - Operation timeout (504, retryable)
- `RATE_LIMIT` - Rate limit exceeded (429, not retryable)
- `INTERNAL` - Internal errors (500, not retryable)

---

## Best Practices

### 1. Always Validate Input

```typescript
import { validateProcessCaseInquiryInput } from 'toto-ai-hub/validators';

const result = validateProcessCaseInquiryInput({
  message,
  caseData,
  userContext,
});

if (!result.success) {
  // Handle validation errors
}
```

### 2. Handle Rate Limits

```typescript
try {
  const response = await totoAI.processCaseMessage(/* ... */);
} catch (error) {
  if (error instanceof RateLimitError) {
    // Wait and retry
    await sleep(error.retryAfterMs);
    return retry();
  }
}
```

### 3. Monitor Metrics

```typescript
// Periodically check metrics
setInterval(() => {
  const metrics = gateway.getMetrics();

  // Alert on high error rate
  if (metrics.errors.error_count > 100) {
    alertTeam('High error rate detected');
  }

  // Alert on high costs
  if (metrics.costs.vertex_ai_calls > 10000) {
    alertTeam('Vertex AI usage spike');
  }
}, 60000); // Every minute
```

### 4. Cache Effectively

Caching is automatic but can be configured:

```env
ENABLE_CACHING=true
LOG_CACHE_STATS=false
```

Check cache effectiveness:

```typescript
const metrics = gateway.getMetrics();
const cacheHitRate =
  metrics.cache.intentCache?.count /
  (metrics.cache.intentCache?.count + missCount);

console.log(`Cache hit rate: ${(cacheHitRate * 100).toFixed(2)}%`);
```

---

For more information, see [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

