import { type AvailableTool } from "..";
import { Maybe } from "../../monads";
import { getGithubProfile } from "../../socials/github/profile";
import type { FunctionType } from "../../ai";

enum TemperatureUnit {
     Celsius = 'celsius',
     Fahrenheit = 'fahrenheit',
}

export interface FunctionRegistry {

     tool: AvailableTool;

     call: FunctionType
}


export const get_current_weather: FunctionRegistry = {
     tool: {
          type: 'function',
          function: {
               name: 'get_current_weather',
               description: 'Get the current weather',
               parameters: {
                    type: 'object',
                    properties: {
                         location: {
                              type: 'string',
                              description: 'The city and state, e.g. San Francisco, CA',
                         },
                         format: {
                              type: 'string',
                              enum: [TemperatureUnit.Celsius, TemperatureUnit.Fahrenheit],
                              description: 'The temperature unit to use. Infer this from the users location.',
                         },
                    },
                    required: ['location', 'format'],
               },
          },
     },
     async call({ location, format }: { location: string; format: TemperatureUnit }) {

          // This is a mock implementation. In a real scenario, you would call a weather API here.
          const temperature = Math.floor(Math.random() * 30) + 10; // Random temperature between 10 and 40
          const unit = format === 'celsius' ? 'C' : 'F';
          const convertedTemp = format === 'celsius' ? temperature : (temperature * 9 / 5) + 32;

          return Maybe.string({
               location,
               temp: convertedTemp,
               unit
          })

     }
}

export const get_github_profile: FunctionRegistry = {
     tool: {
          type: 'function',
          function: {
               name: 'get_github_profile',
               description: 'Get a github profile data',
               parameters: {
                    type: 'object',
                    properties: {
                         username: {
                              type: 'string',
                              description: 'The github username',
                         },
                    },
                    required: ['username'],
               },
          },
     },
     call: async ({ username }: { username: string }, content: string) => {

          const profile = await getGithubProfile(username);

          return Maybe.string(profile);

     }
}

export const search_username: FunctionRegistry = {
     tool: {
          type: 'function',
          function: {
               name: 'search_username',
               description: 'Search for a username accross all social media platforms on the internet, heavy task.',
               parameters: {
                    type: 'object',
                    properties: {
                         query: {
                              type: 'string',
                              description: 'The query to search for',
                         },
                    },
                    required: ['query'],
               },
          }
     },
     async call({ query }: { query: string }) {

          const socials = ["/c/instagram/{}", "/c/tiktok/{}", "/c/x-(twitter)/{}", "/c/facebook/{}", "/c/youtube/{}", "/c/snapchat/{}", "/c/medium/{}", "/c/reddit/{}", "/c/hackernews/{}", "/c/venmo/{}", "/c/soundcloud/{}", "/c/producthunt/{}", "/c/spotify/{}", "/c/github/{}", "/c/gitlab/{}", "/c/minecraft/{}", "/c/twitch/{}", "/c/dribbble/{}", "/c/quora/{}", "/c/9gag/{}", "/c/vk/{}", "/c/goodreads/{}", "/c/blogger/{}", "/c/patreon/{}", "/c/telegram/{}", "/c/redbubble/{}", "/c/slack/{}", "/c/wordpress/{}", "/c/google-playstore/{}", "/c/wix/{}", "/c/roblox/{}", "/c/steamgroup/{}", "/c/strava/{}", "/c/wikipedia/{}", "/c/3dnews/{}", "/c/7cups/{}", "/c/8tracks/{}", "/c/about.me/{}", "/c/academia.edu/{}", "/c/airbit/{}", "/c/allmylinks/{}", "/c/archive.org/{}", "/c/artstation/{}", "/c/asciinema/{}", "/c/askfm/{}", "/c/blip.fm/{}", "/c/bandcamp/{}", "/c/behance/{}", "/c/bikemap/{}", "/c/bitbucket/{}", "/c/bodybuilding/{}", "/c/bookcrossing/{}", "/c/buymeacoffee/{}", "/c/buzzfeed/{}", "/c/cgtrader/{}", "/c/ctan/{}", "/c/carbonmade/{}", "/c/chaos/{}", "/c/clubhouse/{}", "/c/codecademy/{}", "/c/codepen/{}", "/c/dev-community/{}", "/c/dailymotion/{}", "/c/deviantart/{}", "/c/disqus/{}", "/c/docker-hub/{}", "/c/duolingo/{}", "/c/etsy/{}", "/c/exposure/{}", "/c/eyeem/{}", "/c/f3.cool/{}", "/c/fandom/{}", "/c/fiverr/{}", "/c/flickr/{}", "/c/flightradar24/{}", "/c/flipboard/{}", "/c/fosstodon/{}", "/c/freelancer/{}", "/c/freesound/{}", "/c/geeksforgeeks/{}", "/c/genius-(artists)/{}", "/c/genius-(users)/{}", "/c/giphy/{}", "/c/gitbook/{}", "/c/google-play/{}", "/c/gravatar/{}", "/c/gumroad/{}", "/c/hackaday/{}", "/c/hackerone/{}", "/c/hackerrank/{}", "/c/harvard-scholar/{}", "/c/hashnode/{}", "/c/holopin/{}", "/c/icq/{}", "/c/ifttt/{}", "/c/imgur/{}", "/c/instructables/{}", "/c/kaggle/{}", "/c/keybase/{}", "/c/kik/{}", "/c/kongregate/{}", "/c/leetcode/{}", "/c/lesswrong/{}", "/c/letterboxd/{}", "/c/lichess/{}", "/c/linktree/{}", "/c/listed/{}", "/c/livejournal/{}", "/c/lobsters/{}", "/c/lottiefiles/{}", "/c/mapify/{}", "/c/memrise/{}", "/c/mixcloud/{}", "/c/monkeytype/{}", "/c/myanimelist/{}", "/c/myminifactory/{}", "/c/mydramalist/{}", "/c/myspace/{}", "/c/newgrounds/{}", "/c/openstreetmap/{}", "/c/opensource/{}", "/c/psnprofiles.com/{}", "/c/pastebin/{}", "/c/playstore/{}", "/c/polarsteps/{}", "/c/promodj/{}", "/c/pypi/{}", "/c/replit.com/{}", "/c/researchgate/{}", "/c/reverbnation/{}", "/c/rubygems/{}", "/c/rumble/{}", "/c/scratch/{}", "/c/shpock/{}", "/c/signal/{}", "/c/slideshare/{}", "/c/slides/{}", "/c/smugmug/{}", "/c/smule/{}", "/c/sourceforge/{}", "/c/splice/{}", "/c/star-citizen/{}", "/c/tetr.io/{}", "/c/traktrain/{}", "/c/tellonym.me/{}", "/c/tenor/{}", "/c/themeforest/{}", "/c/trawelling/{}", "/c/trello/{}", "/c/unsplash/{}", "/c/vsco/{}", "/c/vimeo/{}", "/c/wattpad/{}", "/c/weebly/{}", "/c/xbox-gamertag/{}", "/c/yandexmusic/{}", "/c/younow/{}", "/c/youpic/{}", "/c/chaos.social/{}", "/c/couchsurfing/{}", "/c/dailykos/{}", "/c/devrant/{}", "/c/freecodecamp/{}", "/c/gfycat/{}", "/c/imgsrc.ru/{}", "/c/interpals/{}", "/c/kofi/{}", "/c/last.fm/{}", "/c/mastodon.cloud/{}", "/c/mastodon.social/{}", "/c/mastodon.technology/{}", "/c/mastodon.xyz/{}", "/c/minds/{}", "/c/mstdn.io/{}", "/c/npm/{}", "/c/osu!/{}", "/c/pikabu/{}", "/c/linkedin/{}", "/c/chess.com/{}"]

          const requests = await Promise.all(socials.map(async (social) => {

               const url = new URL("https://api.instantusername.com");

               url.pathname = social.replace("{}", query);

               const response = await fetch(url);

               try {
                    return await response.json() as {
                         available: boolean;
                         result: string;
                         url: string;
                    };
               } catch (e) {
                    return {
                         available: true,
                         result: "",
                         url: ""
                    }
               }
          }));

          const results = requests.filter(e => !e.available).map(e => e.url).join(", ")

          return Maybe.string(`The username ${query} is an account on the following social media platforms: ${results}`);

     }
}