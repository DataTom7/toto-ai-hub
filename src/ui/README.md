# Chat Message Processor - Usage Guide

## Overview

The `ChatMessageProcessor` is a centralized utility that processes backend responses and generates render-ready messages for the frontend. It follows the golden conversation structure exactly, ensuring consistency between backend and frontend.

## Key Features

- ✅ **Centralized Logic**: All message processing in one place
- ✅ **Golden Conversation Compliant**: Follows the manually reviewed dataset structure
- ✅ **Simple Frontend**: Frontend just renders what backend says
- ✅ **No "Last Bubble" Logic**: Each message knows its own quick actions

## Installation

The processor is exported from `toto-ai-hub`:

```typescript
import { ChatMessageProcessor, RenderableMessage } from 'toto-ai-hub';
```

## Basic Usage

### Processing a Backend Response

```typescript
import { ChatMessageProcessor } from 'toto-ai-hub';

// Backend returns a CaseResponse
const backendResponse = await caseAgent.processCaseInquiry(
  userMessage,
  caseData,
  userContext
);

// Process into render-ready messages
const renderableMessages = ChatMessageProcessor.processBackendResponse(
  backendResponse,
  `msg-${Date.now()}` // Generate unique message ID
);

// renderableMessages is an array of RenderableMessage objects
// Each message has:
// - id: string
// - text: string (full message)
// - paragraphs: string[] (pre-split for rendering)
// - quickActions?: RenderableQuickActions (if applicable)
// - formatting: { shouldShowTyping, typingSpeed, animationDelay }
```

### Rendering Messages

```typescript
// In your React component
{renderableMessages.map((msg) => (
  <React.Fragment key={msg.id}>
    {/* Render paragraphs */}
    {msg.paragraphs.map((para, idx) => (
      <MessageBubble key={idx} text={para} role={msg.role} />
    ))}
    
    {/* Render quick actions if present */}
    {msg.quickActions && (
      <QuickActionsRenderer
        type={msg.quickActions.type}
        config={msg.quickActions.config}
      />
    )}
  </React.Fragment>
))}
```

## Quick Actions Types

The processor extracts quick actions based on backend metadata. Supported types:

### 1. Banking Alias (`banking_alias`)

Shown when user wants to donate and backend provides alias.

```typescript
{
  type: 'banking_alias',
  config: {
    alias: 'TOTO.GUARDIANX',
    label: 'Copiar alias'
  }
}
```

### 2. Social Media (`social_media`)

Shown when user wants to share the case.

```typescript
{
  type: 'social_media',
  config: {
    platforms: [
      { platform: 'instagram', url: 'https://instagram.com/...' },
      { platform: 'twitter', url: 'https://twitter.com/...' },
      { platform: 'facebook', url: 'https://facebook.com/...' }
    ]
  }
}
```

### 3. Donation Amounts (`donation_amounts`)

Shown when user wants to donate but hasn't specified amount.

```typescript
{
  type: 'donation_amounts',
  config: {
    amounts: [1000, 5000, 10000],
    currency: 'ARS'
  }
}
```

### 4. Help Actions (`help_actions`)

Shown when user asks how to help.

```typescript
{
  type: 'help_actions',
  config: {
    actions: [
      { type: 'donate', label: 'Donar' },
      { type: 'share', label: 'Compartir' }
    ]
  }
}
```

### 5. Guardian Contact (`guardian_contact`)

Shown when user wants to contact the guardian.

```typescript
{
  type: 'guardian_contact',
  config: {
    contacts: [
      { channel: 'email', url: 'mailto:guardian@example.com' },
      { channel: 'phone', url: 'tel:+1234567890' },
      { channel: 'whatsapp', url: 'https://wa.me/1234567890' }
    ]
  }
}
```

## Message Formatting

The processor uses backend's `formattingHints` to split messages into paragraphs:

1. **Priority 1**: Uses `formattingHints.suggestedChunks` if available (most accurate)
2. **Priority 2**: Falls back to local paragraph splitting logic

The local logic handles:
- Double newlines (explicit paragraph breaks)
- Bullet points (each bullet is a paragraph)
- Questions (separated into own paragraph)
- Sentence grouping (max 2 sentences per paragraph)

## Typing Animation

The processor provides formatting hints for typing animation:

```typescript
{
  shouldShowTyping: true,  // Whether to show typing animation
  typingSpeed: 50,         // ms per word
  animationDelay: 0        // ms delay before starting
}
```

Use these hints to control the typing animation in your frontend.

## Example: Complete Integration

```typescript
import { ChatMessageProcessor, RenderableMessage } from 'toto-ai-hub';
import { CaseAgent } from 'toto-ai-hub';

// In your chat component
const [messages, setMessages] = useState<RenderableMessage[]>([]);

const handleUserMessage = async (userMessage: string) => {
  // 1. Send to backend
  const backendResponse = await caseAgent.processCaseInquiry(
    userMessage,
    caseData,
    userContext
  );

  // 2. Process into render-ready messages
  const renderableMessages = ChatMessageProcessor.processBackendResponse(
    backendResponse,
    `msg-${Date.now()}`
  );

  // 3. Add to state
  setMessages(prev => [...prev, ...renderableMessages]);
};

// 4. Render
return (
  <div className="chat-container">
    {messages.map((msg) => (
      <React.Fragment key={msg.id}>
        {/* Render message paragraphs */}
        {msg.paragraphs.map((para, idx) => (
          <MessageBubble
            key={`${msg.id}-para-${idx}`}
            text={para}
            role={msg.role}
            shouldShowTyping={msg.formatting?.shouldShowTyping}
            typingSpeed={msg.formatting?.typingSpeed}
          />
        ))}
        
        {/* Render quick actions */}
        {msg.quickActions && (
          <QuickActionsRenderer
            type={msg.quickActions.type}
            config={msg.quickActions.config}
          />
        )}
      </React.Fragment>
    ))}
  </div>
);
```

## Future: Messages Array Support

When the backend is updated to return `messages[]` array (matching golden conversations), use:

```typescript
// Backend returns messages[] array
const backendResponse = {
  success: true,
  messages: [
    {
      message: "First message",
      quickActions: { showBankingAlias: true },
      guardianBankingAlias: "TOTO.XXX"
    },
    {
      message: "Second message",
      // No quick actions
    }
  ]
};

// Process using messages array method
const renderableMessages = ChatMessageProcessor.processMessagesArray(
  backendResponse.messages,
  `msg-${Date.now()}`
);
```

## Key Principles

1. **Trust the Backend**: Frontend doesn't need to "figure out" when to show quick actions
2. **Each Message is Independent**: Each message knows its own quick actions
3. **No "Last Bubble" Logic**: Quick actions are always `position: 'after_message'`
4. **Golden Conversations are Source of Truth**: Processor follows the dataset structure exactly

## Troubleshooting

### Quick Actions Not Showing

1. Check backend metadata has `quickActions` with correct flags
2. Verify `guardianBankingAlias` or other required data is present
3. Check console for processor logs (if added)

### Paragraphs Not Splitting Correctly

1. Backend should provide `formattingHints.suggestedChunks`
2. If not, processor falls back to local logic
3. Check message format (double newlines, bullet points, etc.)

### Typing Animation Issues

1. Use `formatting.shouldShowTyping` to control animation
2. Use `formatting.typingSpeed` for animation speed
3. Use `formatting.animationDelay` for staggered messages

## See Also

- [Golden Conversations Dataset](../../src/data/golden-conversations/)
- [Chat Modal Rebuild Plan](../../CHAT_MODAL_REBUILD_PLAN.md)
- [Frontend Quick Actions Fix](../../../FRONTEND_QUICK_ACTIONS_FIX.md)

