import fs from "fs";
import Cloudflare from 'cloudflare';
import { execSync } from "child_process"

export const cloudflare = new Cloudflare({
     apiEmail: process.env['cloudflare_email'], // This is the default and can be omitted
     apiKey: process.env['cloudflare_key'], // This is the default and can be omitted
});

async function generateCommitMessage(diff: string) {

     const prompt = `Write a detailed git commit message based on the following diff:\n${diff}`;

     try {

          const response = await cloudflare.workers.ai.run("@cf/mistral/mistral-7b-instruct-v0.1", {
               prompt: prompt,
               max_tokens: 1024,
               account_id: process.env.cloudflare_id || "",
          });

          if (typeof response == "object" && "response" in response) {

               if (!response.response) return null

               return response.response.trim();
          }


     } catch (error) {

          console.error('Error generating commit message:', error);

          return null;

     }
}

async function commit(message: string) {
     try {
          execSync('git add .');
          execSync(`git commit -m "${message}"`);
          console.log('Changes committed successfully.');
     } catch (error) {
          console.error('Error committing changes:', error);
     }
}


async function main() {

     let diff: string | undefined;

     try {

          diff = execSync('git diff').toString();

     } catch (e) {

          console.log("Failed to get diff")

     }



     if (!diff) {
          console.log('No changes to commit.');
          return;
     }

     const message = await generateCommitMessage(diff);

     if (!message) {
          console.log('Failed to generate commit message.');
          return;
     }

     console.log('Generated Commit Message:', message);
     fs.writeFileSync('.git/COMMIT_EDITMSG', message);

     // commit(message)
}

await main();
