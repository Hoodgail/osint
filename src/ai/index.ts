import Cloudflare from 'cloudflare';
import OpenAI from "openai";
import type { Maybe, Memory } from '../monads';
import fs from 'fs';
import { memory } from './functions/intergrations/storage';

import {
     GoogleGenerativeAI,
     SchemaType,
} from "@google/generative-ai"

if (!process.env.cloudflare_id) throw new Error("Cloudflare ID not set");
if (!process.env.cloudflare_key) throw new Error("Cloudflare API key not set");
if (!process.env.cloudflare_email) throw new Error("Cloudflare email not set");

const service: "cloudflare" | "google" | "openai" = "cloudflare";

const system = fs.readFileSync("./src/ai/prompts/final.md", "utf8");

export const cloudflare = new Cloudflare({
     apiEmail: process.env['cloudflare_email'],
     apiKey: process.env['cloudflare_key'],
});

const openai = new OpenAI({ baseURL: "https://models.inference.ai.azure.com", apiKey: process.env.github_key as string });

export const google = new GoogleGenerativeAI(
     process.env['google_key'] as string,
);

// Types for the API
export type ParameterProperty = {
     type: SchemaType;
     description: string;
     enum?: string[];
};

export type Parameters = {
     type: SchemaType;
     properties: {
          [key: string]: ParameterProperty;
     };
     required: string[];
};

export type Function = {
     name: string;
     description: string;
     parameters?: Parameters;
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

const model = google.getGenerativeModel({
     model: "gemini-1.5-pro-exp-0801",
     systemInstruction: system,
});

const tools = google.getGenerativeModel({
     model: "gemini-1.5-pro-exp-0801",
     systemInstruction: "Assist the user based on their request using the available tools. Keep responses clear and relevant.",
});

const generationConfig = {
     temperature: 1,
     topP: 0.95,
     topK: 64,
     maxOutputTokens: 8192,
     responseMimeType: "text/plain",
};

export async function final(results: {
     functionName: string;
     error?: string;
     result?: Maybe<string>;
}[], input: string, memorySegment: Maybe<string>, context?: Maybe<string>) {

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

          segments.push(`<${functionName}>\n${result.getOrElse("No result")}</${functionName}>`);

     };

     segments.push(`<memory-recall>\n${memorySegment.getOrElse("No memory\n")}</memory-recall>`);

     if (context) segments.push(`<context>\n${context.getOrElse("No context\n")}</context>`);

     if (service == "cloudflare") {

          const response = await cloudflare.workers.ai.run("@hf/meta-llama/meta-llama-3-8b-instruct", {
               messages: [
                    { role: "system", content: system },
                    { role: "user", content: segments.join("\n") },
                    { role: "user", content: input }
               ],
               max_tokens: 256,
               account_id: process.env["cloudflare_id"]!,
          })

          if ("response" in response) {

               return response.response?.trim();

          }

     } else if (service == "google") {

          const chatSession = model.startChat({
               generationConfig,
               history: [
                    {
                         role: "user",
                         parts: [
                              { text: segments.join("\n") }
                         ],
                    },
               ],
          });

          const result = await chatSession.sendMessage(input);

          return result.response.text()

     } else if (service == "openai") {

          const response = await openai.chat.completions.create({
               messages: [
                    { role: "system", content: system },
                    { role: "user", content: segments.join("\n") },
                    { role: "user", content: input }
               ],
               model: "gpt-4o",
               temperature: 1.,
               max_tokens: 1000,
               top_p: 1.
          });

          return response.choices[0].message.content;

     }

     return null;
}

export async function summarize(content: string) {

     const response = await cloudflare.workers.ai.run("@cf/facebook/bart-large-cnn", {
          input_text: content,
          max_length: 200,
          account_id: process.env.cloudflare_id || "",
     });

     if ("summary" in response) {

          if (response.summary) return response.summary;

          throw new Error("No summary found");

     } else {

          throw new Error("No summary found");

     }

}

export async function processFunctions(functions: AvailableTool[], input: string): Promise<ToolCall[] | null> {

     if (service == "cloudflare") {

          const response = await cloudflare.workers.ai.run("@hf/nousresearch/hermes-2-pro-mistral-7b", {
               messages: [{
                    role: "system",
                    content: "Assist the user based on their request using the available tools. Keep responses clear and relevant."
               }, {
                    role: "user",
                    content: input
               }],
               tools: functions,
               max_tokens: 1024,
               account_id: process.env.cloudflare_id || "",
          });

          const calls = "tool_calls" in response ? response.tool_calls as ToolCall | ToolCall[] : void 0;

          if (!calls) return null;

          else if (!Array.isArray(calls)) return [calls];

          else return calls;

     } else if (service == "google") {

          const session = tools.startChat({
               generationConfig,
               tools: functions.map(tool => {

                    return {
                         functionDeclarations: [{
                              name: tool.function.name,
                              description: tool.function.description,
                              parameters: (!tool.function.parameters || Object.keys(tool.function.parameters).length === 0) ? undefined : tool.function.parameters,
                         }]
                    }

               }),
               history: [
                    {
                         role: "user",
                         parts: [{ text: input }],
                    },
               ]
          });


          const result = await session.sendMessage(input);

          const calls = result.response.functionCalls();

          if (!calls) return null;

          return calls.map(call => {

               return {
                    name: call.name,
                    arguments: call.args as {
                         [key: string]: string;
                    },
               }

          })

     } else if (service == "openai") {

          const response = await openai.chat.completions.create({
               messages: [{
                    role: "system",
                    content: "Assist the user based on their request using the available tools. Keep responses clear and relevant."
               }, {
                    role: "user",
                    content: input
               }],
               tools: functions.map(tool => {
                    return {
                         type: "function",
                         function: {
                              name: tool.function.name,
                              description: tool.function.description,
                              parameters: (!tool.function.parameters || Object.keys(tool.function.parameters).length === 0) ? undefined : tool.function.parameters,
                         }
                    }
               }),
               model: "gpt-4o",
               temperature: 1.,
               max_tokens: 1000,
               top_p: 1.
          });

          if (response.choices[0].finish_reason === "tool_calls") {

               if (!response.choices[0].message.tool_calls) return null;

               return response.choices[0].message.tool_calls.map(e => {
                    return {
                         name: e.function.name,
                         arguments: JSON.parse(e.function.arguments) as {
                              [key: string]: string;
                         },
                    }
               })

          }

     }

     return null;
}

// Function to process input and generate output
export async function processAI(options: {
     context?: Maybe<string>,
     input: string,
     tools: AvailableTool[],
     registry: FunctionRegistry,
     memory?: Memory
}): Promise<string | null> {

     try {

          const memorySegment = await (options.memory ?? memory).get(options.input);

          const calls = await processFunctions(options.tools, options.input);

          if (!calls) {

               const segments: string[] = [];

               segments.push(`-----[memory: recall]\n${memorySegment.getOrElse("No memory")}\n-----`);

               if (options.context) segments.push(`-----[context]\n${options.context.getOrElse("No context")}\n-----`);

               if (service == "cloudflare") {

                    const response = await cloudflare.workers.ai.run("@hf/meta-llama/meta-llama-3-8b-instruct", {
                         messages: [
                              { role: "system", content: system },
                              { role: "system", content: segments.join("\n\n") },
                              { role: "user", content: options.input }
                         ],
                         max_tokens: 256,
                         account_id: process.env["cloudflare_id"]!,
                    })

                    if ("response" in response) {

                         return response.response?.trim() ?? null;

                    } else {

                         return null;

                    }

               } else if (service == "google") {

                    const chatSession = model.startChat({
                         generationConfig,
                         history: [
                              {
                                   role: "user",
                                   parts: [
                                        { text: segments.join("\n") },
                                   ],
                              },
                         ],
                    });

                    const result = await chatSession.sendMessage(options.input);

                    return result.response.text()

               } else {

                    return null;

               }


          }

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

          const result = await final(results, options.input, memorySegment, options.context);

          return result ?? null

     } catch (error) {

          console.error('Error processing function calling:', error);

          return null;
     }
}

