import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { Maybe, Memory } from '../monads';
import { appendFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { processAI } from '../ai';
import readline from 'readline';

import * as defaults from "../../src/ai/functions"
import * as intergrations from "../../src/ai/functions/intergrations"
import { getChannelId } from '../ai/functions/intergrations/discord';

const memory = new Memory("./.discord")

for await (const line of readline.createInterface({
     input: createReadStream("./.discord/references") as unknown as NodeJS.ReadableStream,
     crlfDelay: Infinity
})) {

     if (!line) break;

     const [key, value] = line.split(":");

     memory.put(key, value, true);
}

function getDate(date: Date | null = new Date()) {

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


/**
 * Get lines from a file by their indices.
 * @param {string} filePath - Path to the file.
 * @param {number[]} indexes - Array of line indices to extract (0-based).
 * @returns {Promise<string[]>} - A promise that resolves with an array of lines.
 */
async function getLinesbyIndex(filePath: string, indexes: number[]): Promise<string[]> {

     const fileStream = createReadStream(filePath);

     const rl = readline.createInterface({
          input: fileStream as unknown as NodeJS.ReadableStream,
          crlfDelay: Infinity
     });

     let lineNumber = 0;
     const lines: string[] = [];
     const sortedIndexes = [...new Set(indexes)].sort((a, b) => a - b);
     let nextIndexToFind = sortedIndexes.shift();

     for await (const line of rl) {
          if (nextIndexToFind === lineNumber) {
               lines.push(line);
               nextIndexToFind = sortedIndexes.shift();
          }

          if (nextIndexToFind === undefined) {
               break; // We've found all the lines we need
          }

          lineNumber++;
     }

     return lines;
}


export const discord = new Client({
     partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember],
     intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.GuildMessageReactions,
          GatewayIntentBits.GuildMessageTyping,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.DirectMessageReactions,
          GatewayIntentBits.DirectMessageTyping,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers,
     ]
});

discord.on('ready', () => {

     console.log(`[Discord] ${discord.user?.tag}`);

     // getChannelId("@liagdooh").then(console.log);
});


await discord.login(process.env.discord_token as string);




const registry = [
     ...Object.values(defaults),
     ...Object.values(intergrations)
];

console.log("[functions]", registry.length, "registered");

discord.on(Events.MessageCreate, async interaction => {

     if (interaction.author.bot) return; // Ignore messages from bots

     // if (!interaction.guild) return; // Ignore DMs

     // Trim the content
     let content = interaction.content.trim();

     const mentionRegex = /<@!?&?(\d+)>/g;
     const mentions = content.match(mentionRegex);

     if (mentions) {
          for (const mention of mentions) {
               const id = mention.replace(/<@!?&?(\d+)>/g, '$1');
               let replacement;

               try {
                    if (mention.startsWith('<@&')) {
                         // Role mention
                         if (interaction.guild) {
                              const role = await interaction.guild.roles.fetch(id);
                              replacement = `@${role?.name ?? 'Unknown Role'}`;
                         } else {
                              replacement = '@Unknown Role';
                         }
                    } else {
                         // User mention
                         if (interaction.guild) {
                              const member = await interaction.guild.members.fetch(id);
                              replacement = `@${member.user.username}`;
                         } else {
                              const user = await interaction.client.users.fetch(id);
                              replacement = `@${user.username}`;
                         }
                    }
               } catch (error) {
                    console.error(`Failed to fetch entity ${id}: ${error}`);
                    replacement = mention.startsWith('<@&') ? '@Unknown Role' : '@Unknown User';
               }

               content = content.replace(mention, replacement);
          }
     }

     if (content.length < 1) return;

     // No more than 400 characters
     if (content.length > 400) {

          return await interaction.reply("Sorry, I can't process that much text at once. Please keep it under 400 characters.");
     }

     // await appendFile("./.discord/messages", `${encodeURIComponent(content)}\n`);

     if (interaction.mentions.has(process.env.discord_id as string)) {

          interaction.channel.sendTyping();



          const context = Maybe.string({

               sender: interaction.author.username,

               message_created_at: getDate(interaction.createdAt),

               current_time: getDate(),

               channel: "name" in interaction.channel ? interaction.channel.name : "DM",
               channel_member_count: "memberCount" in interaction.channel
                    ? interaction.channel.memberCount
                    : interaction.guild?.memberCount ?? 0,
               channel_id: "id" in interaction.channel ? interaction.channel.id : "DM",

               channel_owner_id: "ownerId" in interaction.channel ? (interaction.channel.ownerId ?? "N/A") : "DM",
               channel_owner: "ownerId" in interaction.channel && interaction.channel.ownerId ? await interaction.guild?.members.fetch(interaction.channel.ownerId).then(member => member?.user.username ?? "DM") : "N/A",

               mutuals_with_sender: interaction.guild?.members.cache.filter(member => member.user.id !== interaction.author.id).map(member => member.user.username).join(", ") ?? "DM",

               guild: interaction.guild?.name ?? "DM",
               guil_id: interaction.guild?.id ?? "DM",

               sender_id: interaction.author.id,
               sender_roles: interaction.member?.roles.cache.map(role => role.name).join(", ") ?? "N/A",
               sender_join_date: getDate(interaction.member?.joinedAt),
               sender_account_creation_date: getDate(interaction.author.createdAt),
               sender_avatar_url: interaction.author.displayAvatarURL(),

               channel_type: interaction.channel.type,
               channel_topic: "topic" in interaction.channel ? interaction.channel.topic ?? "N/A" : "N/A",
               channel_creation_date: getDate("createdAt" in interaction.channel ? interaction.channel.createdAt : null),

               guild_member_count: interaction.guild?.memberCount ?? "N/A",
               guild_creation_date: getDate(interaction.guild?.createdAt),
               guild_owner: await interaction.guild?.fetchOwner().then(owner => owner.user.username) ?? "N/A",
               guild_boost_level: interaction.guild?.premiumTier ?? "N/A",
               guild_verified: interaction.guild?.verified ?? false,

               last_message_content: interaction.channel.isTextBased()
                    ? (await interaction.channel.messages.fetch({ limit: 1 })).first()?.content ?? "N/A"
                    : "N/A",

               user_permissions: interaction.member?.permissions.toArray().join(", ") ?? "N/A",

               interaction_type: interaction.type,
               client_user: interaction.client.user?.username ?? "N/A",
               client_uptime: Math.floor(interaction.client.uptime / 1000), // in seconds

               is_dm: !interaction.guild,
               is_nsfw: "nsfw" in interaction.channel ? interaction.channel.nsfw : false,

               current_voice_channel: interaction.member?.voice.channel?.name ?? "N/A",
               voice_channel_members: interaction.member?.voice.channel?.members.size ?? 0,

               presence: interaction.member?.presence?.status ?? "offline",
               activity: interaction.member?.presence?.activities[0]?.name ?? "N/A",
          })

          const process = await processAI({
               input: content,
               context,
               tools: registry.map(def => def.tool),
               registry: registry.reduce((acc, def) => ({ ...acc, [def.tool.function.name]: def.call }), {}),
               memory
          });

          await appendFile("./.discord/references", `${interaction.author.username}:${encodeURIComponent(content)}\n`);

          memory.put(interaction.author.username, content + "\n", true);

          if (process && discord.user) {

               await appendFile("./.discord/references", `${discord.user.username}:${encodeURIComponent(process)}\n`);

               memory.put(discord.user.username, process + "\n", true);

               await interaction.reply(process);

          } else {

               await interaction.reply("I'm sorry, I couldn't understand that. Please try again.");
          }


     }

});
