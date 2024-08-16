import { Maybe, Cache } from '../../../../monads';

import { JaroWinklerDistance } from "natural"
import { discord } from '../../../../discord';
import { ChannelType, GuildMember } from 'discord.js';

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

          if (options.channel_name.startsWith("@")) {

               await discord.users.send(channelId, options.content);

               return Maybe.just(`Sent "${encodeURIComponent(options.content)}" to ${options.channel_name}'s DM channel`);

          }

          const channel = await discord.channels.fetch(channelId, { cache: true })

          if (channel?.isTextBased()) {

               await channel.send(options.content);

               return Maybe.just(`Sent "${encodeURIComponent(options.content)}" to ${options.channel_name}`);
          }

          return Maybe.just("Failed to send message, channel is not text based");

     } catch (error) {

          console.error('Error sending message:', error);

          return Maybe.just("Failed to send message");
     }
}

// Function to get all members of a guild
export async function get_guild_members(guild_name: string): Promise<Maybe<[id: string, name: string][]>> {
     return cacher.create(`guild_members_${guild_name}`, async () => {
          try {
               const guildId = await getGuildId(guild_name);
               if (!guildId) {
                    return Maybe.nothing<[id: string, name: string][]>();
               }

               const guild = await discord.guilds.fetch(guildId);
               const members = await guild.members.fetch();

               return Maybe.just(
                    Array.from(members.values()).map(member => [member.id, member.user.username])
               );
          } catch (error) {
               console.error('Error fetching guild members:', error);
               return Maybe.nothing<[id: string, name: string][]>();
          }
     });
}

// Function to search for messages containing specific keywords
export async function search_messages(options: {
     channel_name: string,
     keywords: string[],
     limit: number,
     case_sensitive?: boolean
}): Promise<Maybe<[id: string, content: string, author: string][]>> {
     const channelId = await getChannelId(options.channel_name);
     if (!channelId) {
          return Maybe.nothing<[id: string, content: string, author: string][]>();
     }

     try {
          const channel = await discord.channels.fetch(channelId, { cache: true });
          if (!channel?.isTextBased()) {
               return Maybe.nothing<[id: string, content: string, author: string][]>();
          }

          const messages = await channel.messages.fetch({ limit: options.limit });
          const searchRegex = new RegExp(options.keywords.join('|'), options.case_sensitive ? '' : 'i');

          const matchingMessages = messages.filter(msg => searchRegex.test(msg.content));

          return Maybe.just(
               matchingMessages.map(msg => [msg.id, msg.content, msg.author.username])
          );
     } catch (error) {
          console.error('Error searching messages:', error);
          return Maybe.nothing<[id: string, content: string, author: string][]>();
     }
}


// Function to get server statistics
export async function get_server_stats(guild_name: string): Promise<Maybe<{
     totalMembers: number,
     onlineMembers: number,
     totalChannels: number,
     textChannels: number,
     voiceChannels: number,
     roleCount: number
}>> {
     try {
          const guildId = await getGuildId(guild_name);
          if (!guildId) {
               return Maybe.nothing<{
                    totalMembers: number,
                    onlineMembers: number,
                    totalChannels: number,
                    textChannels: number,
                    voiceChannels: number,
                    roleCount: number
               }>();
          }

          const guild = await discord.guilds.fetch(guildId);
          const members = await guild.members.fetch();
          const channels = await guild.channels.fetch();

          return Maybe.just({
               totalMembers: guild.memberCount,
               onlineMembers: members.filter(member => member.presence?.status !== 'offline').size,
               totalChannels: channels.size,
               textChannels: channels.filter(channel => channel?.type === ChannelType.GuildText).size,
               voiceChannels: channels.filter(channel => channel?.type === ChannelType.GuildVoice).size,
               roleCount: guild.roles.cache.size
          });
     } catch (error) {
          console.error('Error getting server stats:', error);
          return Maybe.nothing<{
               totalMembers: number,
               onlineMembers: number,
               totalChannels: number,
               textChannels: number,
               voiceChannels: number,
               roleCount: number
          }>();
     }
}

export async function getUsers() {

     const users: Map<string, {
          id: string,
          names: Set<string>
     }> = new Map();

     for (let guild of discord.guilds.cache.values()) {

          const collection = await guild.members.fetch();

          for (let member of collection.values()) {

               let cache = users.get(member.user.id);

               if (!cache) {

                    cache = {
                         id: member.user.id,
                         names: new Set()
                    }

                    users.set(member.user.id, cache);
               }

               cache.names.add(member.user.username.toLowerCase());
               cache.names.add(member.user.displayName.toLowerCase());

               if (member.user.globalName) cache?.names.add(member.user.globalName.toLowerCase());

          }
     }

     return Array.from(users.values());
}

// Helper function to get channel ID from channel name
export async function getChannelId(channel_name: string): Promise<string | null> {

     if (channel_name.startsWith('@')) {

          // DM channel
          const handle = channel_name.slice(1).toLowerCase();

          const users = await cacher.create("users", getUsers);

          let channel = users.find(channel => {
               // Convert the handle to lowercase for comparison
               const lowerCaseHandle = handle.toLowerCase();

               // Create an array of lowercase names from the Set
               const namesArray = Array.from(channel.names).map(name => name.toLowerCase());

               // Check if any name in the set matches the criteria
               return namesArray.some(name =>
                    name === lowerCaseHandle ||
                    name.startsWith(lowerCaseHandle) ||
                    name.endsWith(lowerCaseHandle) ||
                    name.includes(lowerCaseHandle)
               );
          });

          if (!channel) {

               const scores = users.map((channel, index) => {
                    // Convert the handle to lowercase for comparison
                    const lowerCaseHandle = handle.toLowerCase();

                    // Convert the Set of names to an array of lowercase strings
                    const namesArray = Array.from(channel.names).map(name => name.toLowerCase());

                    // Compute Jaro-Winkler distance for each name in the array
                    const scoresArray = namesArray.map(name => JaroWinklerDistance(name, lowerCaseHandle));

                    // Find the maximum score among all the names
                    const maxScore = Math.max(...scoresArray);

                    return [index, maxScore];
               }) as [index: number, score: number][];

               if (scores.length === 0) return null;

               const [[index, score]] = scores.sort((a, b) => b[1] - a[1]) as [index: number, score: number][];

               if (+score.toFixed(1) < nlu_tolerance) return null;

               channel = users[index];
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

