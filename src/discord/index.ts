import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { Maybe, Memory } from '../monads';
import { appendFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { processAI } from '../ai';
import readline from 'readline';

import * as defaults from "../../src/ai/functions"
import * as intergrations from "../../src/ai/functions/intergrations"
import { getChannelId } from '../ai/functions/intergrations/discord';
import { DiscordMemoryManager } from '../ai/functions/intergrations/memory/DiscordMemoryManager';




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

const memory = new DiscordMemoryManager(discord, ".discord");

discord.on('ready', () => {

     console.log(`[Discord] ${discord.user?.tag}`);
});


await discord.login(process.env.discord_token as string);

const registry = [
     ...Object.entries(defaults),
     ...Object.entries(intergrations)
];

console.log("[functions]", registry.length, "registered");

discord.on(Events.MessageCreate, async interaction => {

     if (interaction.author.bot) return; // Ignore messages from bots

     // Trim the content
     let content = interaction.content.trim();

     // No more than 400 characters
     if (content.length > 400) {

          return await interaction.reply("Sorry, I can't process that much text at once. Please keep it under 400 characters.");
     }

     // await appendFile("./.discord/messages", `${encodeURIComponent(content)}\n`);

     if (interaction.mentions.has(process.env.discord_id as string)) {

          interaction.channel.sendTyping();

          await memory.handleMessage(interaction, registry);


     }

});
