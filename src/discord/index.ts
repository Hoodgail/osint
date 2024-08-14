import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { Maybe, Memory } from '../monads';
import { appendFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { processAI } from '../ai';
import readline from 'readline';

import * as defaults from "../../src/ai/functions"
import * as intergrations from "../../src/ai/functions/intergrations"

const memory = new Memory("./.discord")

for await (const line of readline.createInterface({
     input: createReadStream("./.discord/references") as unknown as NodeJS.ReadableStream,
     crlfDelay: Infinity
})) {

     if (!line) break;

     const [key, value] = line.split(":");

     memory.put(key, value, true);
}

function getDate(date: Date = new Date()) {

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
     ]
});

discord.on('ready', () => {

     console.log(`[Discord] ${discord.user?.tag}`);
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

     const mentionRegex = /<@!?(\d+)>/g;
     const mentions = content.match(mentionRegex);


     if (mentions) {
          for (const mention of mentions) {
               const id = mention.replace(/<@!?|>/g, '');
               let username;

               if (interaction.guild) {
                    // For guild messages
                    const member = await interaction.guild.members.fetch(id).catch(() => null);
                    username = member ? member.user.username : 'Unknown User';
               } else {
                    // For DMs
                    try {
                         const user = await discord.users.fetch(id);
                         username = user.username;
                    } catch (error) {
                         console.error(`Failed to fetch user ${id}: ${error}`);
                         username = 'Unknown User';
                    }
               }

               content = content.replace(mention, `@${username}`);
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
