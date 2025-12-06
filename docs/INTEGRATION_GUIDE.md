# Integration Guide - toto-bo → toto-ai-hub

Complete guide for integrating toto-ai-hub into toto-bo.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Detailed Integration](#detailed-integration)
- [Common Patterns](#common-patterns)
- [Error Handling](#error-handling)
- [Testing Integration](#testing-integration)
- [Performance Tips](#performance-tips)

---

## Overview

toto-ai-hub provides AI services to toto-bo through the `TotoAPIGateway` class.

**Architecture:**

```
toto-bo (Next.js)
    ↓
TotoAPIGateway
    ↓
[TotoAI → CaseAgent, RAGService, VectorDB, Metrics]
```

**Benefits:**
- Separation of concerns (AI logic isolated)
- Easy testing (mock gateway in tests)
- Performance (caching, rate limiting built-in)
- Observability (metrics out of the box)

---

## Quick Start

### 1. Install toto-ai-hub

```bash
cd toto-bo
npm install ../toto-ai-hub
```

Or via `package.json`:

```json
{
  "dependencies": {
    "toto-ai-hub": "file:../toto-ai-hub"
  }
}
```

### 2. Initialize Gateway

**File:** `lib/ai/gateway.ts`

```typescript
import { TotoAPIGateway } from 'toto-ai-hub';
import { admin } from '@/lib/firebase';

// Singleton instance
let gatewayInstance: TotoAPIGateway | null = null;

export function getAIGateway(): TotoAPIGateway {
  if (!gatewayInstance) {
    gatewayInstance = new TotoAPIGateway(
      admin.firestore() // Share Firestore instance
    );
    // Initialize (loads KB, syncs to Vertex AI)
    gatewayInstance.initialize().catch(console.error);
  }
  return gatewayInstance;
}
```

### 3. Use in API Routes

**File:** `app/api/cases/[caseId]/chat/route.ts`

```typescript
import { getAIGateway } from '@/lib/ai/gateway';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { message, userContext } = await request.json();

    // Get case data from database
    const caseData = await getCaseData(params.caseId);

    // Process with AI
    const gateway = getAIGateway();
    const totoAI = gateway.getTotoAI();
    const response = await totoAI.processCaseMessage(
      message,
      caseData,
      userContext
    );

    return NextResponse.json(response);

  } catch (error) {
    console.error('AI processing error:', error);
    return NextResponse.json(
      { error: 'AI processing failed' },
      { status: 500 }
    );
  }
}
```

---

## Detailed Integration

### Component Integration

#### Chat Component:

```typescript
'use client';

import { useState } from 'react';

export function CaseChatComponent({ caseId, userId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/cases/${caseId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          userContext: {
            userId,
            userRole: 'user',
            language: 'es',
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages(prev => [
          ...prev,
          { role: 'user', content: input },
          { role: 'agent', content: data.message },
        ]);

        // Handle quick actions
        if (data.metadata?.suggestedActions) {
          renderQuickActions(data.metadata.suggestedActions);
        }
      }

      setInput('');
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      {messages.map((msg, i) => (
        <div key={i} className={msg.role}>
          {msg.content}
        </div>
      ))}

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        disabled={loading}
      />
    </div>
  );
}
```

---

### Metrics Dashboard Integration

#### Metrics API Route:

```typescript
// app/api/admin/metrics/route.ts
import { getAIGateway } from '@/lib/ai/gateway';
import { NextResponse } from 'next/server';

export async function GET() {
  const gateway = getAIGateway();
  const metrics = gateway.getMetrics();

  return NextResponse.json({
    costs: {
      vertexAICalls: metrics.costs?.vertex_ai_calls || 0,
      estimatedCost: (metrics.costs?.vertex_ai_calls || 0) * 0.0001, // $0.0001 per call
    },
    performance: {
      avgResponseTime: metrics.performance?.responseTime?.avg || 0,
      p95ResponseTime: metrics.performance?.responseTime?.p95 || 0,
    },
    cache: {
      hitRate: calculateHitRate(metrics.cache),
    },
    quality: {
      intentAccuracy: metrics.quality?.intent_detected || 0,
      successRate: metrics.quality?.inquiry_success || 0,
    },
  });
}
```

#### Dashboard Component:

```typescript
'use client';

import { useEffect, useState } from 'react';

export function AIMetricsDashboard() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then(res => res.json())
      .then(setMetrics);

    const interval = setInterval(() => {
      fetch('/api/admin/metrics')
        .then(res => res.json())
        .then(setMetrics);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  if (!metrics) return <div>Loading...</div>;

  return (
    <div className="metrics-grid">
      <MetricCard
        title="Vertex AI Costs"
        value={`$${metrics.costs.estimatedCost.toFixed(2)}`}
        subtitle={`${metrics.costs.vertexAICalls} calls`}
      />

      <MetricCard
        title="Avg Response Time"
        value={`${metrics.performance.avgResponseTime.toFixed(0)}ms`}
        subtitle={`P95: ${metrics.performance.p95ResponseTime.toFixed(0)}ms`}
      />

      <MetricCard
        title="Cache Hit Rate"
        value={`${(metrics.cache.hitRate * 100).toFixed(1)}%`}
      />

      <MetricCard
        title="Success Rate"
        value={`${(metrics.quality.successRate * 100).toFixed(1)}%`}
      />
    </div>
  );
}
```

---

## Common Patterns

### 1. Conversation History

Maintain conversation context:

```typescript
// Store in database or session
const conversationHistory = await getConversationHistory(userId, caseId);

const gateway = getAIGateway();
const totoAI = gateway.getTotoAI();
const response = await totoAI.processCaseMessage(
  userMessage,
  caseData,
  userContext,
  {
    conversationId: conversationId,
    previousMessages: conversationHistory,
  }
);

// Save new messages
await saveConversation(userId, caseId, {
  userMessage,
  agentResponse: response.message,
});
```

### 2. Quick Actions

Handle quick action buttons:

```typescript
// Render quick actions
function renderQuickActions(suggestedActions) {
  return suggestedActions.map(action => (
    <button
      key={action.type}
      onClick={() => handleQuickAction(action)}
    >
      {action.label}
    </button>
  ));
}

// Handle action click
async function handleQuickAction(action) {
  if (action.type === 'donation') {
    // Send amount as message
    await sendMessage(action.data.amount);
  } else if (action.type === 'share') {
    // Open share dialog
    openShareDialog(action.data.text);
  }
}
```

### 3. Real-time Updates

Show typing indicator:

```typescript
const [isTyping, setIsTyping] = useState(false);

async function sendMessage(message) {
  setIsTyping(true);

  try {
    const gateway = getAIGateway();
    const totoAI = gateway.getTotoAI();
    const response = await totoAI.processCaseMessage(/* ... */);
    // Handle response
  } finally {
    setIsTyping(false);
  }
}
```

---

## Error Handling

### Graceful Degradation

```typescript
import { AppError, RateLimitError } from 'toto-ai-hub/errors';

try {
  const gateway = getAIGateway();
  const totoAI = gateway.getTotoAI();
  const response = await totoAI.processCaseMessage(/* ... */);
  return response;

} catch (error) {
  if (error instanceof RateLimitError) {
    // Show friendly message
    return {
      success: false,
      message: 'Has alcanzado el límite de mensajes. Por favor, espera un momento.',
      retryAfterMs: error.retryAfterMs,
    };
  }

  if (error instanceof AppError) {
    // Use user-friendly message
    return {
      success: false,
      message: error.getUserMessage('es'),
    };
  }

  // Unknown error - log and show generic message
  console.error('Unexpected AI error:', error);
  return {
    success: false,
    message: 'Ocurrió un error. Por favor, intenta nuevamente.',
  };
}
```

### Retry Logic

```typescript
async function sendMessageWithRetry(message, maxRetries = 3) {
  const gateway = getAIGateway();
  const totoAI = gateway.getTotoAI();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await totoAI.processCaseMessage(/* ... */);

    } catch (error) {
      if (error instanceof RateLimitError && attempt < maxRetries) {
        // Wait and retry
        await sleep(error.retryAfterMs || 1000);
        continue;
      }

      throw error; // Give up
    }
  }
}
```

---

## Testing Integration

### Mock Gateway for Tests

```typescript
// __mocks__/toto-ai-hub.ts
export class TotoAPIGateway {
  async initialize() {
    return Promise.resolve();
  }

  getTotoAI() {
    return {
      processCaseMessage: jest.fn().mockResolvedValue({
        success: true,
        message: 'Mock AI response',
        metadata: {},
      }),
    };
  }

  getMetrics() {
    return {
      summary: {},
      performance: {},
      cache: {},
      costs: {},
      quality: {},
      errors: {},
    };
  }
}
```

**Test:**

```typescript
import { getAIGateway } from '@/lib/ai/gateway';

jest.mock('toto-ai-hub');

describe('Chat API', () => {
  it('should process message', async () => {
    const gateway = getAIGateway();
    const totoAI = gateway.getTotoAI();
    const response = await totoAI.processCaseMessage({
      message: 'Test',
      caseData: mockCaseData,
      userContext: mockUserContext,
    });

    expect(response.success).toBe(true);
  });
});
```

---

## Performance Tips

### 1. Cache Gateway Instance

```typescript
// ✅ Good - Singleton
let gateway: TotoAPIGateway;
export function getAIGateway() {
  if (!gateway) {
    gateway = new TotoAPIGateway();
    gateway.initialize().catch(console.error);
  }
  return gateway;
}

// ❌ Bad - New instance every time
export function getAIGateway() {
  return new TotoAPIGateway();
}
```

### 2. Batch Requests When Possible

```typescript
// Process multiple messages in parallel
const gateway = getAIGateway();
const totoAI = gateway.getTotoAI();

const responses = await Promise.all([
  totoAI.processCaseMessage(params1),
  totoAI.processCaseMessage(params2),
  totoAI.processCaseMessage(params3),
]);
```

### 3. Monitor Cache Hit Rates

```typescript
setInterval(() => {
  const gateway = getAIGateway();
  const metrics = gateway.getMetrics();
  const hitRate = calculateCacheHitRate(metrics);

  if (hitRate < 0.5) {
    console.warn('Low cache hit rate:', hitRate);
  }
}, 300000); // Every 5 minutes
```

### 4. Use Server Components

```typescript
// app/cases/[caseId]/page.tsx
export default async function CasePage({ params }) {
  // Fetch on server - faster, no client bundle
  const caseData = await getCaseData(params.caseId);

  return <CaseChat initialData={caseData} />;
}
```

---

## Migration from toto-agent

If migrating from the old toto-agent implementation:

### 1. Replace Imports

```typescript
// Old
import { TotoAgent } from 'toto-agent';

// New
import { TotoAPIGateway } from 'toto-ai-hub';
```

### 2. Update Method Calls

```typescript
// Old
const agent = new TotoAgent();
const response = await agent.process(message, context);

// New
const gateway = getAIGateway();
const totoAI = gateway.getTotoAI();
const response = await totoAI.processCaseMessage(
  message,
  caseData,
  userContext
);
```

### 3. Update Response Handling

```typescript
// Old response format
{
  text: string;
  actions?: string[];
}

// New response format
{
  success: boolean;
  message: string;
  metadata?: {
    suggestedActions?: Array<{
      type: string;
      label: string;
      data?: any;
    }>;
  };
}
```

---

## Support

**Issues? Check:**
1. [API.md](./API.md) - Complete API reference
2. [ENVIRONMENT.md](./ENVIRONMENT.md) - Environment variables
3. Troubleshooting sections in each guide

**Still stuck?** Contact the development team.

---

For more information, see [../README.md](../README.md).

