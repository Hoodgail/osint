import axios, { type AxiosResponse } from 'axios';
import { Maybe, Cache } from '../../../../monads';
import type { APIGuild } from 'discord-api-types/v10';
import type { APIChannel } from 'discord-api-types/v9';

import { JaroWinklerDistance } from "natural"
import { discord } from '../../../../discord';
import { ChannelType } from 'discord.js';

const nlu_tolerance = 0.7;

// Cache implementation
const cacher = new Cache();

// Function to get guilds
export async function get_guilds(): Promise<Maybe<[id: string, name: string][]>> {

     return cacher.create('guilds', async () => {

          try {

               const guilds = await discord.guilds.fetch({ limit: 100 })

               return Maybe.just(
                    guilds.map(guild => [guild.id, guild.name])
               );

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

                    const guild = await discord.guilds.fetch({ guild: bestMatch.id, cache: true });

                    const channels = await guild.channels.fetch(void 0, { cache: true });

                    return Maybe.just(Array.from(channels.values()).filter(e => e).map(channel => [channel!.id, channel!.name]));

               }) as Maybe<[id: string, name: string][]>;

          } catch (error) {
               console.error('Error fetching guild channels:', error);
               return Maybe.nothing<[id: string, name: string][]>();
          }
     });
}
// Function to get direct messages
export async function get_direct_messages(): Promise<Maybe<string[]>> {

     const direct_messages = Array.from(discord.channels.cache.filter(channel => channel.type === ChannelType.DM).values());

     return Maybe.just(

          direct_messages.map(channel => channel.recipient?.username.toLowerCase() ?? "unknown")

     );

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
}): Promise<Maybe<string[][]>> {
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

          const channel = await discord.channels.fetch(channelId, { cache: true })

          if (channel?.isTextBased()) {

               let messages = await channel.messages.fetch({
                    cache: true,
                    limit: options.limit,
                    ...(options.before && { before: options.before }),
                    ...(options.after && { after: options.after }),
                    ...(options.has && { has: options.has }),
                    ...(options.mentions && { mentions: options.mentions })
               });

               if (options.mentioned) {

                    messages = messages.filter(msg => msg.mentions.has(process.env.discord_id as string));
               }

               const result = messages.map(e => {
                    return [e.id, e.content]
               })

               return Maybe.just(result);
          }

          return Maybe.nothing<any[]>();


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

          const channel = await discord.channels.fetch(channelId, { cache: true })

          if (channel?.isTextBased()) {

               await channel.send(options.content);

               return Maybe.just("Message sent successfully");
          }

          return Maybe.just("Failed to send message, channel is not text based");

     } catch (error) {
          console.error('Error sending message:', error);
          return Maybe.just("Failed to send message");
     }
}

// Helper function to get channel ID from channel name
async function getChannelId(channel_name: string): Promise<string | null> {


     if (channel_name.startsWith('@')) {

          // DM channel
          const handle = channel_name.slice(1).toLowerCase();

          let channel = discord.channels.cache.find(channel => {

               if (channel.type !== ChannelType.DM) return false;

               if (!channel.recipient) return false;

               const user = channel.recipient.username.toLowerCase();

               const global_name = channel.recipient.username.toLowerCase();

               return user === handle || global_name === handle ||
                    user.startsWith(handle) || global_name.startsWith(handle) ||
                    user.endsWith(handle) || global_name.endsWith(handle) ||
                    user.includes(handle) || global_name.includes(handle);
          });

          const channels = Array.from(discord.channels.cache.values())

          if (!channel) {

               const scores = channels.map((channel, index) => {

                    if (channel.type !== ChannelType.DM) return [index, 0];

                    if (!channel.recipient) return [index, 0];

                    const username = channel.recipient.username.toLowerCase();
                    const global_name = channel.recipient.username.toLowerCase();

                    let username_score = JaroWinklerDistance(username, handle);
                    let global_name_score = JaroWinklerDistance(global_name, handle);

                    return [index, Math.max(username_score, global_name_score)]

               }) as [index: number, score: number][];

               if (scores.length === 0) return null;

               const [[index, score]] = scores.sort((a, b) => b[1] - a[1]) as [index: number, score: number][];

               if (+score.toFixed(1) < nlu_tolerance) return null;

               channel = channels[index];
          }

          return channel.id

     } else if (channel_name.startsWith('#')) {

          // Guild channel
          const handle = channel_name.slice(1).toLowerCase();

          const guilds = await get_guilds();

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