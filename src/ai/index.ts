import Cloudflare from 'cloudflare';
import type { Maybe } from '../monads';
import fs from 'fs';
import { memory } from './functions/intergrations/storage';

if (!process.env.cloudflare_id) throw new Error("Cloudflare ID not set");
if (!process.env.cloudflare_key) throw new Error("Cloudflare API key not set");
if (!process.env.cloudflare_email) throw new Error("Cloudflare email not set");

const system = fs.readFileSync("./src/ai/prompts/final.md", "utf8");

export const cloudflare = new Cloudflare({
     apiEmail: process.env['cloudflare_email'],
     apiKey: process.env['cloudflare_key'],
});

// Types for the API
export type ParameterProperty = {
     type: string;
     description: string;
     enum?: string[];
};

export type Parameters = {
     type: string;
     properties: {
          [key: string]: ParameterProperty;
     };
     required: string[];
};

export type Function = {
     name: string;
     description: string;
     parameters: Parameters;
};

export type AvailableTool = {
     type: 'function';
     function: Function;
};

export type ToolCall = {
     name: string;
     arguments: {
          [key: string]: string;
     };
};

export type FunctionType = (args: any, prompt: string, tools: ToolCall[]) => Promise<Maybe<string>> | Maybe<string>;

// Function registry type
export type FunctionRegistry = {
     [key: string]: FunctionType
};

export interface Segment {
     model: string;
     created_at: Date;
     response: string;
     done: boolean;
}

export interface DoneSegment extends Segment {
     done_reason: string;
     total_duration: number;
     load_duration: number;
     prompt_eval_count: number;
     prompt_eval_duration: number;
     eval_count: number;
     eval_duration: number;
}

export async function prompt(options: {
     prompt: string;
     raw?: boolean
} | {
     messages: {
          content: string;

          role: string;
     }[]
}) {

     try {

          const response = await cloudflare.workers.ai.run("@hf/thebloke/llama-2-13b-chat-awq", {
               ...options,
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


export async function final(results: {
     functionName: string;
     error?: string;
     result?: Maybe<string>;
}[], memorySegment: Maybe<string>) {

     const segments: string[] = [];

     for (let { error, functionName, result } of results) {

          if (error) {

               console.error(`[${functionName}]`, error);

               continue;
          };

          if (!result) {

               console.error(`[${functionName}]`, "No result");

               continue;
          }

          segments.push(`-----[${functionName}]\n${result.getOrElse("No result")}\n-----`);

     };

     // return segments.join("\n\n");

     const response = await cloudflare.workers.ai.run("@cf/mistral/mistral-7b-instruct-v0.1", {
          messages: [
               { role: "system", content: system },
               { role: "user", content: `<memory>\n${memorySegment.getOrElse("No memory")}\n</memory>` },
               { role: "user", content: segments.join("\n\n") }
          ],
          max_tokens: 256,
          account_id: process.env["cloudflare_id"]!,
     })

     if ("response" in response) {

          return response.response?.trim();

     }

     return null;
}


// Function to process input and generate output
export async function processAI(options: {
     context?: string,
     input: string,
     tools: AvailableTool[],
     registry: FunctionRegistry
}): Promise<string> {

     try {

          const memorySegment = await memory.get(options.input);

          const response = await cloudflare.workers.ai.run("@hf/nousresearch/hermes-2-pro-mistral-7b", {
               messages: [{
                    role: "system",
                    content: "Assist the user based on their request using the available tools. Keep responses clear and relevant."
               }, {
                    role: "user",
                    content: options.input
               }],
               tools: options.tools,
               max_tokens: 1024,
               account_id: process.env.cloudflare_id || "",
          });

          let calls = "tool_calls" in response ? response.tool_calls as ToolCall | ToolCall[] : void 0;

          if (!calls) {

               const response = await cloudflare.workers.ai.run("@cf/mistral/mistral-7b-instruct-v0.1", {
                    messages: [
                         { role: "system", content: system },
                         { role: "user", content: `<memory>\n${memorySegment.getOrElse("No memory")}\n</memory>` },
                         { role: "user", content: options.input }
                    ],
                    max_tokens: 256,
                    account_id: process.env["cloudflare_id"]!,
               })

               if ("response" in response) {

                    return response.response?.trim() ?? "No response";

               } else {

                    return "No response";

               }


          }

          if (!Array.isArray(calls)) calls = [calls];

          console.log("[tool_calls]", calls.map(call => call.name));

          // Execute the function calls
          const results = await Promise.all(calls.map(async (call) => {

               if (call.name && options.registry[call.name]) {

                    console.time(`[function: ${call.name}]`);

                    const result = await options.registry[call.name](call.arguments, options.input, calls);

                    console.timeEnd(`[function: ${call.name}]`);

                    return { functionName: call.name, result };

               } else {

                    return { functionName: call.name, error: 'Function not found in registry' };

               }
          }));

          const result = await final(results, memorySegment);

          return result ?? 'No result';

     } catch (error) {
          console.error('Error processing function calling:', error);
          return 'An error occurred while processing the function calling.';
     }
}

