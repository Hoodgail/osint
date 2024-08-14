import type { FunctionRegistry } from "../../";
import { memory } from ".";
import { SchemaType } from "@google/generative-ai";

export const append_memory: FunctionRegistry = {
     tool: {
          type: 'function',
          function: {
               name: 'append_memory',
               description: 'Appends or updates a detailed value in the system\'s memory, associated with a specific key',
               parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                         key: {
                              type: SchemaType.STRING,
                              description: 'The unique identifier or contextual key under which the value will be stored. This could be a topic, category, or any relevant identifier for easy retrieval later.',
                         },
                         value: {
                              type: SchemaType.STRING,
                              description: 'The detailed information to be stored in memory. This should be a comprehensive and well-structured description, potentially including context, relationships, or any other relevant details that would be valuable for future recall and use.',
                         },
                    },
                    required: ['key', 'value'],
               },
          },
     },
     call: (options: { key: string, value: string }) => {
          return memory.set(options.key, options.value);
     }
};

export const recall_memory: FunctionRegistry = {
     tool: {
          type: 'function',
          function: {
               name: 'recall_memory',
               description: 'Retrieves a stored value from the system\'s memory based on a given context or key',
               parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                         context: {
                              type: SchemaType.STRING,
                              description: 'The unique identifier or contextual key associated with the memory to be retrieved. This could be a specific topic, category, or any relevant identifier used when the memory was initially stored.',
                         },
                    },
                    required: ['context'],
               },
          },
     },
     call: (options: { context: string }) => memory.get(options.context)
};