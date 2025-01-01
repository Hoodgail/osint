import Cloudflare from 'cloudflare';
import OpenAI from "openai";
import { Client as Gradio } from "@gradio/client";
import Anthropic from '@anthropic-ai/sdk';
import type { Tool as AnthropicTool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages"

import type { Maybe, Memory } from '../monads';
import fs from 'fs';
import { memory } from './functions/intergrations/storage';

import {
     GoogleGenerativeAI,
} from "@google/generative-ai"

if (!process.env.cloudflare_id) throw new Error("Cloudflare ID not set");
if (!process.env.cloudflare_key) throw new Error("Cloudflare API key not set");
if (!process.env.cloudflare_email) throw new Error("Cloudflare email not set");

type Service = "cloudflare" | "google" | "openai" | "anthropic" | "gradio";

const service: Service = "openai";
const functionService: Service = "openai";

// if (service == "gradio") throw new Error("Gradio not supported yet");

const system = fs.readFileSync("./src/ai/prompts/final.md", "utf8");

export const cloudflare = new Cloudflare({
     apiEmail: process.env['cloudflare_email'],
     apiKey: process.env['cloudflare_key'],
});

const anthropic = new Anthropic({
     apiKey: process.env["anthropic_key"]
});

export const google = new GoogleGenerativeAI(
     process.env['google_key'] as string
);
const openai = new OpenAI({});


const gradio: Gradio | null = null;

export enum SchemaType {
     /** String type. */
     STRING = "string",
     /** Number type. */
     NUMBER = "number",
     /** Integer type. */
     INTEGER = "integer",
     /** Boolean type. */
     BOOLEAN = "boolean",
     /** Array type. */
     ARRAY = "array",
     /** Object type. */
     OBJECT = "object"
}


// Types for the API
export type ParameterProperty = {
     type: SchemaType;
     description: string;
     items?: Omit<ParameterProperty, 'description'>;
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

     }
     else if (service == "anthropic") {

          const response = await anthropic.messages.create({
               model: "claude-3-sonnet-20240229",
               messages: [
                    { role: 'user', content: segments.join("\n") },
                    { role: 'user', content: input }
               ],
               system: system,
               max_tokens: 1024
          });

          return "text" in response.content[0] ? response.content[0].text : null;

     } else if (service == "openai") {

          const response = await openai.chat.completions.create({
               messages: [
                    { role: "system", content: system },
                    { role: "user", content: segments.join("\n") },
                    { role: "user", content: input }
               ],
               model: "gpt-4o-mini",
               temperature: 1.,
               max_tokens: 1000,
               top_p: 1.
          });

          return response.choices[0].message.content;

     } else if (service == "gradio" && gradio) {

          const result = await gradio.predict("/chat", {
               message: `${segments.join("\n")}\n${input}`,
               system_message: system
          });

          return result.data as string;

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

     if (functionService == "cloudflare" || functionService == "gradio") {

          const response = await cloudflare.workers.ai.run("@hf/nousresearch/hermes-2-pro-mistral-7b", {
               messages: [{
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

     }
     else if (functionService === "anthropic") {
          const messages = [{
               role: "user",
               content: input
          }];

          const tools: AnthropicTool[] = functions.map(tool => {
               const parameters = (!tool.function.parameters ||
                    Object.keys(tool.function.parameters).length === 0) ?
                    undefined : tool.function.parameters;

               const input_schema: AnthropicTool["input_schema"] = {
                    // ...(tool.function.parameters ? tool.function.parameters : {}),
                    type: "object",
                    properties: parameters || {}
               }

               console.log(input_schema)

               return {

                    name: tool.function.name,
                    description: tool.function.description,
                    input_schema: input_schema

               };
          })

          const response = await anthropic.messages.create({
               messages: messages as any,
               model: "claude-3-sonnet-20240229",
               max_tokens: 1024,
               temperature: 1,
               system: "Assist the user based on their request using the available tools. Keep responses clear and relevant.",
               tools: tools
          });

          if (response.content[0].type !== 'tool_use') {
               return null;
          }
          const toolUseBlocks = response.content
               .filter((block): block is ToolUseBlock => block.type === 'tool_use')
               .map(block => ({
                    name: block.name,
                    arguments: block.input as {
                         [key: string]: string;
                    }
               }));

          return toolUseBlocks.length > 0 ? toolUseBlocks : null;

     }
     else if (functionService == "google") {

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

     } else if (functionService == "openai") {

          const response = await openai.chat.completions.create({
               messages: [{
                    role: "system",
                    content: "You are a helpful assistant that can use various tools to help users. Analyze the user's request and select the most appropriate tool(s) to fulfill their needs. Available tools include memory storage, message sending, weather checking, profile lookups, and more. Always use the most relevant tool for the task."
               }, {
                    role: "user",
                    content: input
               }],
               tool_choice: "required",
               tools: functions.map(tool => {

                    const parameters = (!tool.function.parameters || Object.keys(tool.function.parameters).length === 0) ? undefined : tool.function.parameters;

                    if (parameters) parameters.type = parameters.type.toLowerCase() as any;

                    return {
                         type: "function",
                         function: {
                              name: tool.function.name,
                              description: tool.function.description,
                              parameters: parameters,
                         }
                    }
               }),
               model: "gpt-4o",
               temperature: 1.,
               max_tokens: 1000,
               top_p: 1.
          });

          console.log(response.choices[0].message)


          if (response.choices[0].message.tool_calls) {

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

     console.log(options.registry)

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

               } else if (service == "gradio" && gradio) {

                    const result = await gradio.predict("/chat", {
                         message: `${segments.join("\n")}\n${options.input}`,
                         system_message: system
                    });

                    return result.data as string;

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

                    console.log(options.registry)

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

