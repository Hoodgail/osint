
import type { FunctionRegistry } from '../../../functions';

import * as discord from '.';
import { Maybe } from '../../../../monads';

export const get_discord_guilds: FunctionRegistry = {
  tool: {
    type: 'function',
    function: {
      name: 'get_discord_guilds',
      description: 'Get an array of guild discord names that the user is in',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  call: () => Maybe.string(discord.get_guilds())
};

export const get_discord_guild: FunctionRegistry = {
  tool: {
    type: 'function',
    function: {
      name: 'get_discord_guild_channels',
      description: 'Get the channels of a specific discord guild',
      parameters: {
        type: 'object',
        properties: {
          guild_name: {
            type: 'string',
            description: 'The name of the guild',
          },
        },
        required: ['guild_name'],
      },
    },
  },
  call: ({ guild_name }: { guild_name: string }) => Maybe.string(discord.get_guild_channels(guild_name))
};

export const get_discord_direct_messages: FunctionRegistry = {
  tool: {
    type: 'function',
    function: {
      name: 'get_discord_direct_messages',
      description: 'Get an array of discord direct message channel names',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  call: () => Maybe.string(discord.get_direct_messages())
};

export const get_discord_unread_messages: FunctionRegistry = {
  tool: {
    type: 'function',
    function: {
      name: 'get_discord_unread_messages',
      description: 'Get discord unread mentions, ignoring @everyone and @here',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  call: () => Maybe.string(discord.get_unread_messages())
};

export const get_discord_messages: FunctionRegistry = {
  tool: {
    type: 'function',
    function: {
      name: 'get_discord_messages',
      description: 'Get discord messages from a specific channel',
      parameters: {
        type: 'object',
        properties: {
          channel_name: {
            type: 'string',
            description: 'The name of the channel (starts with @ for DMs, # for guild channels)',
          },
          limit: {
            type: 'number',
            description: 'The maximum number of messages to retrieve',
          },
          mentioned: {
            type: 'boolean',
            description: 'Whether to filter for messages that mention the user',
          },
          before: {
            type: 'string',
            description: 'Get messages before this message ID',
          },
          after: {
            type: 'string',
            description: 'Get messages after this message ID',
          },
          has: {
            type: 'string',
            enum: ['link', 'embed', 'file', 'image', 'video', 'audio'],
            description: 'Filter messages that have a specific type of content',
          },
          mentions: {
            type: 'string',
            description: 'Array of usernames to filter mentions (comma separated)',
          },
        },
        required: ['channel_name', 'limit'],
      },
    },
  },
  call: (options: {
    channel_name: string,
    limit: number,
    mentioned?: boolean,
    before?: string,
    after?: string,
    has?: 'link' | 'embed' | 'file' | 'image' | 'video' | 'audio',
    mentions?: string
  }) => Maybe.string(discord.get_messages(options))
};

export const send_discord_message: FunctionRegistry = {
  tool: {
    type: 'function',
    function: {
      name: 'send_discord_message',
      description: 'Send a message to a specific channel',
      parameters: {
        type: 'object',
        properties: {
          channel_name: {
            type: 'string',
            description: 'The name of the channel (starts with @ for DMs, # for guild channels)',
          },
          content: {
            type: 'string',
            description: 'The content of the message to send',
          },
        },
        required: ['channel_name', 'content'],
      },
    },
  },
  call: (options: { channel_name: string, content: string }) => discord.send_message(options).then(result => result.isEmpty() ? Maybe.just("Failed to send message") : Maybe.just("Sent message successfully"))
};