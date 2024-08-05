import axios, { type AxiosResponse } from 'axios';
import { Maybe, Cache } from '../../../../monads';
import type { APIGuild } from 'discord-api-types/v10';
import type { APIChannel } from 'discord-api-types/v9';

import { JaroWinklerDistance } from "natural"

if (typeof process.env.discord_token === 'undefined') {

     throw new Error('Discord token not found in environment variables');
}

if (typeof process.env.discord_id === 'undefined') {

     throw new Error('Discord ID not found in environment variables');
}

// API base URL and token (replace with actual values)
const API_BASE_URL = 'https://discord.com/api/v10';

// Axios instance with default configuration
const api = axios.create({
     baseURL: API_BASE_URL,
     headers: {
          'Authorization': `${process.env.discord_token}`,
          'Content-Type': 'application/json',
     },
});

const nlu_tolerance = 0.7;

// Cache implementation
const cacher = new Cache();

// Function to get guilds
export async function get_guilds(): Promise<Maybe<[id: string, name: string][]>> {

     return cacher.create('guilds', async () => {

          try {

               const response: AxiosResponse<APIGuild[]> = await api.get('/users/@me/guilds');

               return Maybe.just(response.data.map(guild => [guild.id, guild.name]));

          } catch (error) {

               console.error('Error fetching guilds:', error);

               return Maybe.nothing<[string, string][]>();

          }
     });
}

// Function to get guild channels
export async function get_guild_channels(guild_name: string): Promise<Maybe<[id: string, name: string][]>> {
     return cacher.create(`guild_channels_${guild_name}`, async () => {
          try {
               const guilds = await get_guilds();

               return await guilds.flatMap(async (list) => {
                    // Find the best matching guild using JaroWinklerDistance
                    const guildScores = list.map(([id, name]) => ({
                         id,
                         name,
                         score: JaroWinklerDistance(name.toLowerCase(), guild_name.toLowerCase())
                    }));

                    const bestMatch = guildScores.reduce((best, current) =>
                         current.score > best.score ? current : best
                    );

                    if (bestMatch.score < nlu_tolerance) {
                         console.log(`No guild found matching "${guild_name}". Did you mean "${bestMatch.name}"?`);
                         return Maybe.nothing<[id: string, name: string][]>();
                    }

                    console.log(`Using guild "${bestMatch.name}" (match score: ${bestMatch.score.toFixed(2)})`);

                    const response: AxiosResponse<any[]> = await api.get(`/guilds/${bestMatch.id}/channels`);

                    return Maybe.just(response.data.map(channel => [channel.id, channel.name]));
               }) as Maybe<[id: string, name: string][]>;

          } catch (error) {
               console.error('Error fetching guild channels:', error);
               return Maybe.nothing<[id: string, name: string][]>();
          }
     });
}
// Function to get direct messages
export async function get_direct_messages(): Promise<Maybe<string[]>> {

     const direct_messages = await cacher.create('direct_messages', getChannels)

     return Maybe.just(

          direct_messages.getOrElse([])

               .filter(channel => channel.type === 1)

               .map(channel => channel.recipients?.[0].username.toLowerCase() ?? "unknown")

     );

}

// Function to get unread messages
export async function get_unread_messages(): Promise<Maybe<string[]>> {
     return cacher.create('unread_messages', async () => {
          try {
               const response: AxiosResponse<any[]> = await api.get('/users/@me/mentions', {
                    params: { limit: 100 }
               });
               return Maybe.just(response.data
                    .filter(mention => !mention.mention_everyone && !mention.mention_here)
                    .map(mention => `${mention.author.username}: ${mention.content}`));
          } catch (error) {
               console.error('Error fetching unread messages:', error);
               return Maybe.nothing<string[]>();
          }
     });
}

// Function to get messages
export async function get_messages(options: {
     channel_name: string,
     limit: number,
     mentioned?: boolean,
     before?: string,
     after?: string,
     has?: "link" | "embed" | "file" | "image" | "video" | "audio",
     mentions?: string
}): Promise<Maybe<any[]>> {
     const channelId = await getChannelId(options.channel_name);

     if (!channelId) {
          return Maybe.nothing<any[]>();
     }

     const params: any = {
          limit: options.limit,
          ...(options.before && { before: options.before }),
          ...(options.after && { after: options.after }),
          ...(options.has && { has: options.has }),

     };

     if (options.mentions && options.mentions.length > 0) {
          params.mentions = options.mentions
     }

     try {
          const response: AxiosResponse<any[]> = await api.get(`/channels/${channelId}/messages`, { params });
          let messages = response.data;

          if (options.mentioned) {
               messages = messages.filter(msg => msg.mentions.some((mention: any) => mention.id === process.env.discord_id));
          }

          return Maybe.just(messages);
     } catch (error) {
          console.error('Error fetching messages:', error);
          return Maybe.nothing<any[]>();
     }
}

// Function to send a message
export async function send_message(options: { channel_name: string, content: string }): Promise<Maybe<string>> {
     const channelId = await getChannelId(options.channel_name);
     if (!channelId) {
          return Maybe.nothing<string>();
     }

     try {

          const response: AxiosResponse<any> = await api.post(`/channels/${channelId}/messages`, {
               content: options.content
          });

          return Maybe.just(response.data.id ?? "Failed to send message");

     } catch (error) {
          console.error('Error sending message:', error);
          return Maybe.nothing<string>();
     }
}

async function getChannels(): Promise<Maybe<APIChannel[]>> {
     try {
          const response: AxiosResponse<APIChannel[]> = await api.get('/users/@me/channels');
          return Maybe.just(response.data);
     } catch (error) {
          console.error('Error fetching direct messages:', error);
          return Maybe.nothing<APIChannel[]>();
     }
}

// Helper function to get channel ID from channel name
async function getChannelId(channel_name: string): Promise<string | null> {

     if (channel_name.startsWith('@')) {

          // DM channel
          const handle = channel_name.slice(1).toLowerCase();

          const direct_messages = await cacher.create('direct_messages', getChannels)

          const channels = direct_messages.getOrElse([]);

          let channel = channels.find(channel => {

               if (channel.type !== 1) return false;

               return channel.recipients?.some((recipient) => {

                    const user = recipient.username.toLowerCase();

                    const global_name = recipient.username.toLowerCase();

                    return user === handle || global_name === handle ||
                         user.startsWith(handle) || global_name.startsWith(handle) ||
                         user.endsWith(handle) || global_name.endsWith(handle) ||
                         user.includes(handle) || global_name.includes(handle);

               })

          });

          if (!channel) {

               const scores = channels.map((channel, index) => {

                    if (channel.type !== 1) return [index, 0];

                    if (!channel.recipients) return [index, 0];

                    const username = channel.recipients[0].username.toLowerCase();
                    const global_name = channel.recipients[0].username.toLowerCase();

                    let username_score = JaroWinklerDistance(username, handle);
                    let global_name_score = JaroWinklerDistance(global_name, handle);

                    return [index, Math.max(username_score, global_name_score)];

               });

               const [[index, score]] = scores.sort((a, b) => b[1] - a[1]) as [index: number, score: number][];

               if (+score.toFixed(1) < nlu_tolerance) return null;

               channel = channels[index];
          }

          return channel.id

     } else if (channel_name.startsWith('#')) {

          // Guild channel
          const handle = channel_name.slice(1).toLowerCase();

          const guilds = await cacher.create('guilds', get_guilds);

          let bestMatch: { channel: string; score: number } | null = null;

          for (const [, guildName] of guilds.getOrElse([])) {

               const list = await get_guild_channels(guildName);

               const channels = list.getOrElse([]);

               const channelScores = channels.map(([id, channelName]) => {

                    const name = channelName.toLowerCase();

                    let score = JaroWinklerDistance(name, handle);

                    return { channel: id, score };
               });

               const bestChannelMatch = channelScores.sort((a, b) => b.score - a.score)[0];

               if (!bestMatch || bestChannelMatch.score > bestMatch.score) {

                    bestMatch = bestChannelMatch;
               }
          }

          if (bestMatch && bestMatch.score >= nlu_tolerance) {

               return bestMatch.channel;
          }
     }
     return null;
}

async function getGuildId(guild_name: string): Promise<string | null> {
     const guilds = await get_guilds();
     const guildList = guilds.getOrElse([]);

     const guildScores = guildList.map(([id, name]) => ({
          id,
          name,
          score: JaroWinklerDistance(name.toLowerCase(), guild_name.toLowerCase())
     }));

     const bestMatch = guildScores.reduce((best, current) =>
          current.score > best.score ? current : best
     );

     if (bestMatch.score >= nlu_tolerance) {
          return bestMatch.id;
     }

     console.log(`No guild found matching "${guild_name}". Did you mean "${bestMatch.name}"?`);
     return null;
}