import { scrape } from "../../scraper";
import type { Profile } from "../../types/types";

export interface GithubProfile extends Profile {

     repos: number;

     stars: number;

     projects: number;

     /**
      * @example 4,977 contributions in the last year: Contributed to coollabsio/coolify, coollabsio/coolify-examples, coollabsio/coolify.io and 26 other repositories
      */
     contributions: string[]

     orgs: string[]

     aboutMe?: string;

};

export async function getGithubProfile(username: string): Promise<GithubProfile> {

     const document = await scrape(`https://github.com/${username}`);

     let name: string = (document.querySelector(".p-name, .vcard-fullname") as HTMLElement)?.innerText ?? "unknown"

     let location: string = (document.querySelector('[itemprop="homeLocation"] span') as HTMLElement)?.innerText ?? "unknown"

     let stars: number = parseInt(
          (document.querySelector("#stars-tab .Counter") as HTMLElement)?.innerText ?? "0"
     )

     let repos: number = parseInt(
          (document.querySelector("#repositories-tab .Counter") as HTMLElement)?.innerText ?? "0"
     )

     let projects: number = parseInt(
          (document.querySelector("#projects-tab .Counter") as HTMLElement)?.innerText ?? "0"
     )

     let bio: string = (document.querySelector('div[itemtype="http://schema.org/Person"] .user_profile_bio') as HTMLElement)?.innerText ?? "";

     let links: string[] = [];

     for (let element of document.querySelectorAll('[itemprop="social"] a, [itemprop="url"] a') as NodeListOf<HTMLLinkElement>) {

          links.push(element.href)

     }

     const aboutMe = (document.querySelector("#user-profile-frame article") as HTMLDivElement)?.innerText?.trim()

     let [followers, following] = [...document.querySelectorAll('.js-profile-editable-area .color-fg-default')]
          .map(element => element.textContent)
          .filter(e => e)
          .map(e => parseInt(e as string))

     let orgs: string[] = [...document.querySelectorAll('div[itemtype="http://schema.org/Person"] [data-hovercard-type="organization"]')].map(element => element.getAttribute("data-hovercard-url")).filter(e => e) as string[]

     let contributions: string[] = [];

     {

          const document = await scrape(`https://github.com/${username}?action=show&controller=profiles&tab==contributions&user_id=${username}`, {
               headers: {
                    "x-requested-with": "XMLHttpRequest",
               }
          });

          contributions = await Promise.all([...document.querySelectorAll('.year-list-container .js-year-link') as NodeListOf<HTMLLinkElement>].map(async (element) => {

               const url = new URL(element.href);

               const from = url.searchParams.get("from");

               const to = url.searchParams.get("to");

               const document = await scrape(`https://github.com/users/${username}/contributions?from=${from}&to=${to}`, {
                    headers: {
                         "x-requested-with": "XMLHttpRequest",
                    }
               });

               const head = document.querySelector("h2")?.innerText.trim() ?? `from ${from} to ${to}`

               const details = (document.querySelector(".wb-break-word") as HTMLDivElement)?.innerText.trim() ?? "No details"

               return `${head}: ${details}`

          }))
     }

     return {

          social: "github",

          username,

          name,

          location,

          bio,

          followers,

          following,

          stars,

          repos,

          projects,

          links,

          contributions,

          orgs,

          aboutMe

     }

}