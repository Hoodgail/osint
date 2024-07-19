import { JSDOM } from "jsdom";

export async function scrape(url: string, init?: RequestInit): Promise<Document> {

     const response = await fetch(url, init);

     if (response.ok) {

          const dom = new JSDOM(
               await response.text()
          );

          return dom.window.document;
     }

     throw new Error("Failed to scrape");
}