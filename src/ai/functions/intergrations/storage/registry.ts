import type { FunctionRegistry } from "../../";
import { memory } from ".";

export const set_memory: FunctionRegistry = {
     tool: {
          type: 'function',
          function: {
               name: 'set_memory',
               description: 'Set a value in memory',
               parameters: {
                    type: 'object',
                    properties: {
                         key: {
                              type: 'string',
                              description: 'The key to set',
                         },
                         value: {
                              type: 'string',
                              description: 'The value to set',
                         },
                    },
                    required: ['key', 'value'],
               },
          },
     },
     call: (options: { key: string, value: string }) => memory.set(options.key, options.value)
};

export const get_memory: FunctionRegistry = {
     tool: {
          type: 'function',
          function: {
               name: 'get_memory',
               description: 'Get a value from memory',
               parameters: {
                    type: 'object',
                    properties: {
                         key: {
                              type: 'string',
                              description: 'The key to get',
                         },
                    },
                    required: ['key'],
               },
          },
     },
     call: (options: { key: string }) => memory.get(options.key)
};