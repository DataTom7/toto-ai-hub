/**
 * Action Configuration Utilities
 * Centralizes action message templates, labels, and configuration
 * This allows toto-app to consume action configs without hardcoding logic
 */

export interface ActionConfig {
  actionType: 'contact' | 'copy_alias' | 'share';
  channel: string;
  label: string; // User-facing label (e.g., "Email", "WhatsApp", "Copy Alias")
  icon?: string; // Icon identifier (e.g., "mail", "phone", "copy")
  order: number; // Display order (lower = first)
  showAsUserMessage: boolean; // Whether to show as user message in UI (true for share, false for others)
  analyticsMessage: string; // Message for analytics (hidden from UI)
  userMessage?: string; // User-facing message (only if showAsUserMessage is true)
}

export interface ActionMessageTemplate {
  actionType: 'contact' | 'copy_alias' | 'share';
  analyticsTemplate: string; // Template for analytics message (e.g., "User contacted guardian via {channel}")
  userMessageTemplate?: string; // Template for user-facing message (only for share)
}

export interface ShareMessageConfig {
  template: string; // Template for share message (e.g., "{name}\n\n{description}\n\n{url}")
  includeCaseName: boolean;
  includeDescription: boolean;
  includeUrl: boolean;
}

/**
 * Get action message template for a given action type
 */
export function getActionMessageTemplate(
  actionType: 'contact' | 'copy_alias' | 'share',
  channel: string,
  context?: {
    caseName?: string;
    platform?: string;
  }
): ActionMessageTemplate {
  const templates: Record<string, ActionMessageTemplate> = {
    copy_alias: {
      actionType: 'copy_alias',
      analyticsTemplate: 'User copied banking alias',
    },
    share: {
      actionType: 'share',
      analyticsTemplate: `User shared case via ${channel}`,
      userMessageTemplate: context?.platform 
        ? `Compartí el caso en ${getPlatformLabel(context.platform)}`
        : `Compartí el caso en ${channel}`,
    },
    contact: {
      actionType: 'contact',
      analyticsTemplate: 'User contacted guardian via {channel}',
    },
  };

  return templates[actionType] || {
    actionType,
    analyticsTemplate: `User performed ${actionType} action via ${channel}`,
  };
}

/**
 * Get platform label in Spanish
 */
function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    instagram: 'Instagram',
    twitter: 'Twitter',
    facebook: 'Facebook',
  };
  return labels[platform.toLowerCase()] || platform;
}

/**
 * Get share message configuration
 */
export function getShareMessageConfig(): ShareMessageConfig {
  return {
    template: '{name}\n\n{description}\n\n{url}',
    includeCaseName: true,
    includeDescription: true,
    includeUrl: true,
  };
}

/**
 * Format share message using template
 */
export function formatShareMessage(
  config: ShareMessageConfig,
  data: {
    name: string;
    description: string;
    url: string;
  }
): string {
  let message = config.template;
  
  if (config.includeCaseName) {
    message = message.replace('{name}', data.name);
  } else {
    message = message.replace('{name}\n\n', '');
  }
  
  if (config.includeDescription) {
    message = message.replace('{description}', data.description);
  } else {
    message = message.replace('{description}\n\n', '');
  }
  
  if (config.includeUrl) {
    message = message.replace('{url}', data.url);
  } else {
    message = message.replace('\n\n{url}', '');
  }
  
  return message.trim();
}

/**
 * Get action configuration for quick action buttons
 * This provides metadata about how actions should be displayed and tracked
 */
export function getActionConfig(
  actionType: 'contact' | 'copy_alias' | 'share',
  channel: string
): ActionConfig {
  const configs: Record<string, Record<string, ActionConfig>> = {
    contact: {
      email: {
        actionType: 'contact',
        channel: 'email',
        label: 'Email',
        icon: 'mail',
        order: 1,
        showAsUserMessage: false,
        analyticsMessage: 'User contacted guardian via email',
      },
      phone: {
        actionType: 'contact',
        channel: 'phone',
        label: 'Phone',
        icon: 'phone',
        order: 2,
        showAsUserMessage: false,
        analyticsMessage: 'User contacted guardian via phone',
      },
      whatsapp: {
        actionType: 'contact',
        channel: 'whatsapp',
        label: 'WhatsApp',
        icon: 'phone',
        order: 3,
        showAsUserMessage: false,
        analyticsMessage: 'User contacted guardian via WhatsApp',
      },
      instagram: {
        actionType: 'contact',
        channel: 'instagram',
        label: 'Instagram',
        icon: 'instagram',
        order: 4,
        showAsUserMessage: false,
        analyticsMessage: 'User contacted guardian via Instagram',
      },
      twitter: {
        actionType: 'contact',
        channel: 'twitter',
        label: 'Twitter',
        icon: 'twitter',
        order: 5,
        showAsUserMessage: false,
        analyticsMessage: 'User contacted guardian via Twitter',
      },
      facebook: {
        actionType: 'contact',
        channel: 'facebook',
        label: 'Facebook',
        icon: 'facebook',
        order: 6,
        showAsUserMessage: false,
        analyticsMessage: 'User contacted guardian via Facebook',
      },
    },
    copy_alias: {
      banking_alias: {
        actionType: 'copy_alias',
        channel: 'banking_alias',
        label: 'Copy Alias',
        icon: 'copy',
        order: 1,
        showAsUserMessage: false,
        analyticsMessage: 'User copied banking alias',
      },
    },
    share: {
      instagram: {
        actionType: 'share',
        channel: 'instagram',
        label: 'Share on Instagram',
        icon: 'instagram',
        order: 1,
        showAsUserMessage: true,
        analyticsMessage: 'User shared case via Instagram',
        userMessage: 'Compartí el caso en Instagram',
      },
      twitter: {
        actionType: 'share',
        channel: 'twitter',
        label: 'Share on Twitter',
        icon: 'twitter',
        order: 2,
        showAsUserMessage: true,
        analyticsMessage: 'User shared case via Twitter',
        userMessage: 'Compartí el caso en Twitter',
      },
      facebook: {
        actionType: 'share',
        channel: 'facebook',
        label: 'Share on Facebook',
        icon: 'facebook',
        order: 3,
        showAsUserMessage: true,
        analyticsMessage: 'User shared case via Facebook',
        userMessage: 'Compartí el caso en Facebook',
      },
    },
  };

  return configs[actionType]?.[channel] || {
    actionType,
    channel,
    label: channel,
    order: 999,
    showAsUserMessage: false,
    analyticsMessage: `User performed ${actionType} action via ${channel}`,
  };
}

