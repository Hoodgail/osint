
import type { FunctionRegistry } from '../../../functions';

import * as discord from '.';
import { Maybe } from '../../../../monads';
import { SchemaType } from '@google/generative-ai';

export const get_discord_guilds: FunctionRegistry = {
  tool: {
    type: 'function',
    function: {
      name: 'get_discord_guilds',
      description: 'Get an array of guild discord names that the user is in',
      parameters: {
        type: SchemaType.OBJECT,
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
        type: SchemaType.OBJECT,
        properties: {
          guild_name: {
            type: SchemaType.STRING,
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
        type: SchemaType.OBJECT,
        properties: {},
        required: [],
      },
    },
  },
  call: () => Maybe.string(discord.get_direct_messages())
};



export const get_discord_messages: FunctionRegistry = {
  tool: {
    type: 'function',
    function: {
      name: 'get_discord_messages',
      description: 'Get discord messages from a specific channel',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          channel_name: {
            type: SchemaType.STRING,
            description: 'The name of the channel (starts with @ for DMs, # for guild channels)',
          },
          limit: {
            type: SchemaType.NUMBER,
            description: 'The maximum number of messages to retrieve',
          },
          mentioned: {
            type: SchemaType.BOOLEAN,
            description: 'Whether to filter for messages that mention the user',
          },
          before: {
            type: SchemaType.STRING,
            description: 'Get messages before this message ID',
          },
          after: {
            type: SchemaType.STRING,
            description: 'Get messages after this message ID',
          },
          has: {
            type: SchemaType.STRING,
            enum: ['link', 'embed', 'file', 'image', 'video', 'audio'],
            description: 'Filter messages that have a specific type of content',
          },
          mentions: {
            type: SchemaType.STRING,
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
      description: 'Send a message to a specific discordchannel',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          channel_name: {
            type: SchemaType.STRING,
            description: 'The name of the channel (starts with @ for DMs, # for guild channels)',
          },
          content: {
            type: SchemaType.STRING,
            description: 'The content of the message to send',
          },
        },
        required: ['channel_name', 'content'],
      },
    },
  },
  call: (options: { channel_name: string, content: string }) => discord.send_message(options).then(result => result.isEmpty() ? Maybe.just("Failed to send message") : Maybe.just("Sent message successfully"))
};

export const get_guild_members: FunctionRegistry = {
  tool: {
    type: 'function',
    function: {
      name: 'get_guild_members',
      description: 'Get all members of a specific Discord guild',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          guild_name: {
            type: SchemaType.STRING,
            description: 'The name of the guild',
          },
        },
        required: ['guild_name'],
      },
    },
  },
  call: ({ guild_name }: { guild_name: string }) => Maybe.string(discord.get_guild_members(guild_name))
};

export const search_messages: FunctionRegistry = {
  tool: {
    type: 'function',
    function: {
      name: 'search_messages',
      description: 'Search for messages containing specific keywords in a Discord channel',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          channel_name: {
            type: SchemaType.STRING,
            description: 'The name of the channel (starts with @ for DMs, # for guild channels)',
          },
          keywords: {
            type: SchemaType.ARRAY,
            // items: { type: SchemaType.STRING },
            description: 'Array of keywords to search for',
          },
          limit: {
            type: SchemaType.NUMBER,
            description: 'The maximum number of messages to search through',
          },
          case_sensitive: {
            type: SchemaType.BOOLEAN,
            description: 'Whether the search should be case-sensitive',
          },
        },
        required: ['channel_name', 'keywords', 'limit'],
      },
    },
  },
  call: (options: {
    channel_name: string,
    keywords: string[],
    limit: number,
    case_sensitive?: boolean
  }) => Maybe.string(discord.search_messages(options))
};

export const get_server_stats: FunctionRegistry = {
  tool: {
    type: 'function',
    function: {
      name: 'get_server_stats',
      description: 'Get statistics for a specific Discord server',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          guild_name: {
            type: SchemaType.STRING,
            description: 'The name of the guild',
          },
        },
        required: ['guild_name'],
      },
    },
  },
  call: ({ guild_name }: { guild_name: string }) => Maybe.string(discord.get_server_stats(guild_name))
};