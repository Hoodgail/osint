import { EnhancedMemory, type UserPreferences } from './enhanced-memory';
import { Client, Message } from 'discord.js';
import { processAI, } from '../../..';
import { Maybe } from '../../../../monads';
import type { FunctionRegistry } from '../..';

export class DiscordMemoryManager {
     private memory: EnhancedMemory;

     constructor(
          private readonly client: Client,
          private readonly basePath: string
     ) {
          this.memory = new EnhancedMemory(basePath);
     }

     async initialize(): Promise<void> {
          await this.memory.initialize();
          console.log('[DiscordMemoryManager] Initialized');
     }

     async handleMessage(message: Message, registry: Array<[string, FunctionRegistry]>): Promise<void> {
          if (message.author.bot) return;

          // Store the message in memory
          const key = `message:${message.id}`;
          await this.memory.store(key, {
               content: message.content,
               metadata: {
                    type: 'conversation',
                    tags: ['discord', `user:${message.author.id}`, `channel:${message.channel.id}`],
                    source: 'discord'
               },
               ttl: 30 * 24 * 60 * 60 * 1000 // 30 days retention for messages
          });

          // Store/update user preferences if they've changed
          const userPrefs: UserPreferences = {
               language: message.guild?.preferredLocale || 'en',
               timezone: message.guild?.preferredLocale || 'UTC',
               communicationStyle: 'casual',
               customSettings: {
                    guildId: message.guild?.id,
                    lastActiveChannel: message.channel.id,
                    lastActiveTimestamp: Date.now()
               }
          };
          await this.memory.setPreferences(message.author.id, userPrefs);

          // Get relevant context from memory for AI processing
          const context = await this.getRelevantContext(message);

          // Process with AI
          if (message.mentions.has(this.client.user!.id)) {
               const response = await processAI({
                    input: message.content,
                    context: Maybe.string(context),
                    tools: Object.values(registry).map(([, r]) => r.tool),
                    registry: Object.entries(registry).reduce((acc, [, [name, tool]]) => ({
                         ...acc,
                         [name]: tool.call
                    }), {})
               });

               if (response) {
                    await message.reply(response);

                    // Store the bot's response in memory
                    const responseKey = `response:${message.id}`;
                    await this.memory.store(responseKey, {
                         content: response,
                         metadata: {
                              type: 'conversation',
                              tags: ['discord', 'bot-response', `user:${message.author.id}`, `channel:${message.channel.id}`],
                              source: 'discord'
                         },
                         ttl: 30 * 24 * 60 * 60 * 1000 // 30 days retention for responses
                    });
               }
          }
     }

     getDate(date: Date | null = new Date()) {

          if (!date) return "N/A";

          const time = date.toLocaleTimeString('en-US', {
               hour: 'numeric',
               minute: 'numeric',
               second: 'numeric',
               hour12: true,
               timeZoneName: 'short'
          });

          const datePart = date.toLocaleDateString('en-GB').replace(/\//g, '/'); // 'en-GB' format will give DD/MM/YYYY

          return `${datePart} ${time}`;
     }

     private async getRelevantContext(message: Message): Promise<string> {
          // Get user preferences
          const userPrefs = this.memory.getPreferences(message.author.id);

          // Get relevant message history
          const recentMessages = await this.memory.recall(message.content, {
               type: 'conversation',
               limit: 5,
               minSimilarity: 0.3
          });

          // Get any user-specific data
          const userData = await this.memory.recall(`user:${message.author.id}`, {
               type: 'userData',
               limit: 3
          });

          const interactionContext = Maybe.string({

               sender: message.author.username,

               message_created_at: this.getDate(message.createdAt),

               current_time: this.getDate(),

               channel: "name" in message.channel ? message.channel.name : "DM",
               channel_member_count: "memberCount" in message.channel
                    ? message.channel.memberCount
                    : message.guild?.memberCount ?? 0,
               channel_id: "id" in message.channel ? message.channel.id : "DM",

               channel_owner_id: "ownerId" in message.channel ? (message.channel.ownerId ?? "N/A") : "DM",
               channel_owner: "ownerId" in message.channel && message.channel.ownerId ? await message.guild?.members.fetch(message.channel.ownerId).then(member => member?.user.username ?? "DM") : "N/A",

               mutuals_with_sender: message.guild?.members.cache.filter(member => member.user.id !== message.author.id).map(member => member.user.username).join(", ") ?? "DM",

               guild: message.guild?.name ?? "DM",
               guil_id: message.guild?.id ?? "DM",

               sender_id: message.author.id,
               sender_roles: message.member?.roles.cache.map(role => role.name).join(", ") ?? "N/A",
               sender_join_date: this.getDate(message.member?.joinedAt),
               sender_account_creation_date: this.getDate(message.author.createdAt),
               sender_avatar_url: message.author.displayAvatarURL(),

               channel_type: message.channel.type,
               channel_topic: "topic" in message.channel ? message.channel.topic ?? "N/A" : "N/A",
               channel_creation_date: this.getDate("createdAt" in message.channel ? message.channel.createdAt : null),

               guild_member_count: message.guild?.memberCount ?? "N/A",
               guild_creation_date: this.getDate(message.guild?.createdAt),
               guild_owner: await message.guild?.fetchOwner().then(owner => owner.user.username) ?? "N/A",
               guild_boost_level: message.guild?.premiumTier ?? "N/A",
               guild_verified: message.guild?.verified ?? false,

               last_message_content: message.channel.isTextBased()
                    ? (await message.channel.messages.fetch({ limit: 1 })).first()?.content ?? "N/A"
                    : "N/A",

               user_permissions: message.member?.permissions.toArray().join(", ") ?? "N/A",

               interaction_type: message.type,
               client_user: message.client.user?.username ?? "N/A",
               client_uptime: Math.floor(message.client.uptime / 1000), // in seconds

               is_dm: !message.guild,
               is_nsfw: "nsfw" in message.channel ? message.channel.nsfw : false,

               current_voice_channel: message.member?.voice.channel?.name ?? "N/A",
               voice_channel_members: message.member?.voice.channel?.members.size ?? 0,

               presence: message.member?.presence?.status ?? "offline",
               activity: message.member?.presence?.activities[0]?.name ?? "N/A",
          })


          // Combine context
          const context = [
               interactionContext,
               userPrefs ? `User Preferences: ${JSON.stringify(userPrefs)}` : '',
               recentMessages.length > 0 ? 'Recent Related Messages:' : '',
               ...recentMessages.map(m => `- ${m.entry.content}`),
               userData.length > 0 ? 'User Data:' : '',
               ...userData.map(d => `- ${d.entry.content}`)
          ].filter(Boolean).join('\n');

          return context;
     }

     async cleanup(): Promise<void> {
          // Perform periodic cleanup of expired memories
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          await this.memory.forget({
               before: thirtyDaysAgo,
               type: 'conversation'
          });

          // Keep user data and preferences
          console.log('[DiscordMemoryManager] Cleanup completed');
     }
}