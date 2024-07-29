import axios, { type AxiosResponse } from 'axios';
import { Maybe, Cache } from '../../../../monads';

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

// Cache implementation
const cacher = new Cache();

// Function to get guilds
export async function get_guilds(): Promise<Maybe<string[]>> {

     return cacher.create('guilds', async () => {

          try {

               const response: AxiosResponse<any[]> = await api.get('/users/@me/guilds');

               return Maybe.just(response.data.map(guild => guild.name as string));

          } catch (error) {

               console.error('Error fetching guilds:', error);

               return Maybe.nothing<string[]>();

          }
     });
}

// Function to get guild channels
export async function get_guild(guild_name: string): Promise<Maybe<string[]>> {

     return cacher.create(`guild_channels_${guild_name}`, async () => {

          try {

               const guilds = await get_guilds();

               return guilds.flatMap(async (guildNames) => {

                    const guild = guildNames.find(name => name === guild_name);

                    if (!guild) {
                         return Maybe.nothing<string[]>();
                    }

                    const guildId = (await api.get('/users/@me/guilds')).data.find((g: any) => g.name === guild_name).id;

                    const response: AxiosResponse<any[]> = await api.get(`/guilds/${guildId}/channels`);

                    return Maybe.just(response.data.map(channel => channel.name));

               });
          } catch (error) {
               console.error('Error fetching guild channels:', error);
               return Maybe.nothing<string[]>();
          }
     });
}

// Function to get direct messages
export async function get_direct_messages(): Promise<Maybe<string[]>> {

     const direct_messages = await cacher.create('direct_messages', getChannels)

     return Maybe.just(
          direct_messages.getOrElse([])
               .filter(channel => channel.type === 1).map(channel => channel.recipients[0].username.toLowerCase())
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

async function getChannels(): Promise<Maybe<any[]>> {
     try {
          const response: AxiosResponse<any[]> = await api.get('/users/@me/channels');
          return Maybe.just(response.data);
     } catch (error) {
          console.error('Error fetching direct messages:', error);
          return Maybe.nothing<string[]>();
     }
}

// Helper function to get channel ID from channel name
async function getChannelId(channel_name: string): Promise<string | null> {
     if (channel_name.startsWith('@')) {

          // DM channel
          const username = channel_name.slice(1).toLowerCase();

          const direct_messages = await cacher.create('direct_messages', getChannels)

          const channel = direct_messages.getOrElse([])
               .filter(channel => channel.type === 1)
               .find(channel => channel.recipients.some((recipient: any) => recipient.username.toLowerCase() === username))

          return channel.id

     } else if (channel_name.startsWith('#')) {
          // Guild channel
          const channelName = channel_name.slice(1);
          const guilds = await get_guilds();
          for (const guildName of guilds.getOrElse([]) ?? []) {

               const channels = await get_guild(guildName);

               const channel = await channels.flatMap(async c => Maybe.just(c.find(ch => ch === channelName)) ?? Maybe.nothing<string>());

               if (channel.getOrElse(null)) {

                    return channel.getOrElse(null) ?? null;
               }
          }
     }
     return null;
}