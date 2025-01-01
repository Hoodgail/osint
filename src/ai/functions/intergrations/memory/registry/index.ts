import type { FunctionRegistry } from '../../../index';
import { Maybe } from "../../../../../monads";
import { EnhancedMemory } from "../enhanced-memory";
import { SchemaType } from '../../../..';


// Initialize the enhanced memory system
const memory = new EnhancedMemory("./.discord/enhanced");
await memory.initialize();

export const store_memory: FunctionRegistry = {
     tool: {
          type: 'function',
          function: {
               name: 'store_memory',
               description: 'Store information in the enhanced memory system',
               parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                         key: {
                              type: SchemaType.STRING,
                              description: 'Unique identifier for the memory',
                         },
                         content: {
                              type: SchemaType.STRING,
                              description: 'The content to store',
                         },
                         type: {
                              type: SchemaType.STRING,
                              enum: ['conversation', 'preference', 'userData'],
                              description: 'Type of memory being stored',
                         },
                         tags: {
                              type: SchemaType.ARRAY,
                              description: 'Optional tags for categorizing the memory',
                              items: { type: SchemaType.STRING },
                         },
                         ttl: {
                              type: SchemaType.NUMBER,
                              description: 'Optional time-to-live in milliseconds',
                         },
                    },
                    required: ['key', 'content', 'type'],
               },
          },
     },
     async call({ key, content, type, tags, ttl }: {
          key: string;
          content: string;
          type: 'conversation' | 'preference' | 'userData';
          tags?: string[];
          ttl?: number;
     }) {
          try {
               await memory.store(key, {
                    content,
                    metadata: { type, tags },
                    ttl,
               });
               return Maybe.just(`Successfully stored memory with key: ${key}`);
          } catch (error) {
               console.error('Error storing memory:', error);
               return Maybe.just(`Failed to store memory: ${error}`);
          }
     }
};

export const recall_memory: FunctionRegistry = {
     tool: {
          type: 'function',
          function: {
               name: 'recall_memory',
               description: 'Retrieve memories based on context',
               parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                         context: {
                              type: SchemaType.STRING,
                              description: 'Context to search for relevant memories',
                         },
                         type: {
                              type: SchemaType.STRING,
                              enum: ['conversation', 'preference', 'userData'],
                              description: 'Optional type of memories to retrieve',
                         },
                         minSimilarity: {
                              type: SchemaType.NUMBER,
                              description: 'Minimum similarity threshold (0-1)',
                         },
                         limit: {
                              type: SchemaType.NUMBER,
                              description: 'Maximum number of memories to retrieve',
                         },
                    },
                    required: ['context'],
               },
          },
     },
     async call({ context, type, minSimilarity, limit }: {
          context: string;
          type?: 'conversation' | 'preference' | 'userData';
          minSimilarity?: number;
          limit?: number;
     }) {
          try {
               const results = await memory.recall(context, { type, minSimilarity, limit });
               if (results.length === 0) {
                    return Maybe.just('No relevant memories found');
               }

               const formattedResults = results.map(({ entry, similarity }) => {
                    return `[${similarity.toFixed(2)}] ${entry.content}`;
               }).join('\n');

               return Maybe.just(formattedResults);
          } catch (error) {
               console.error('Error recalling memory:', error);
               return Maybe.just(`Failed to recall memories: ${error}`);
          }
     }
};

export const forget_memory: FunctionRegistry = {
     tool: {
          type: 'function',
          function: {
               name: 'forget_memory',
               description: 'Remove specific memories from the system',
               parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                         key: {
                              type: SchemaType.STRING,
                              description: 'Specific memory key to forget',
                         },
                         type: {
                              type: SchemaType.STRING,
                              enum: ['conversation', 'preference', 'userData'],
                              description: 'Type of memories to forget',
                         },
                         before: {
                              type: SchemaType.NUMBER,
                              description: 'Forget memories older than this timestamp',
                         },
                         tags: {
                              type: SchemaType.ARRAY,
                              description: 'Forget memories with specific tags',
                              items: { type: SchemaType.STRING },
                         },
                    },
                    required: [],
               },
          },
     },
     async call({ key, type, before, tags }: {
          key?: string;
          type?: 'conversation' | 'preference' | 'userData';
          before?: number;
          tags?: string[];
     }) {
          try {
               const count = await memory.forget({ key, type, before, tags });
               return Maybe.just(`Successfully removed ${count} memories`);
          } catch (error) {
               console.error('Error forgetting memories:', error);
               return Maybe.just(`Failed to forget memories: ${error}`);
          }
     }
};

export const manage_preferences: FunctionRegistry = {
     tool: {
          type: 'function',
          function: {
               name: 'manage_preferences',
               description: 'Store or retrieve user preferences',
               parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                         userId: {
                              type: SchemaType.STRING,
                              description: 'User ID to manage preferences for',
                         },
                         action: {
                              type: SchemaType.STRING,
                              enum: ['get', 'set'],
                              description: 'Whether to get or set preferences',
                         },
                         preferences: {
                              type: SchemaType.OBJECT,
                              description: 'Preferences to store (for set action)',
                              properties: {
                                   language: {
                                        type: SchemaType.STRING,
                                        description: 'Preferred language',
                                   },
                                   timezone: {
                                        type: SchemaType.STRING,
                                        description: 'Preferred timezone',
                                   },
                                   communicationStyle: {
                                        type: SchemaType.STRING,
                                        enum: ['formal', 'casual'],
                                        description: 'Preferred communication style',
                                   },
                                   notificationPreferences: {
                                        type: SchemaType.OBJECT,
                                        properties: {
                                             enabled: { type: SchemaType.BOOLEAN },
                                             types: {
                                                  type: SchemaType.ARRAY,
                                                  items: { type: SchemaType.STRING }
                                             }
                                        },
                                        description: 'Notification settings'
                                   },
                                   customSettings: {
                                        type: SchemaType.OBJECT,
                                        description: 'Any additional custom settings'
                                   }
                              }
                         }
                    },
                    required: ['userId', 'action'],
               },
          },
     },
     async call({ userId, action, preferences }: {
          userId: string;
          action: 'get' | 'set';
          preferences?: {
               language?: string;
               timezone?: string;
               communicationStyle?: 'formal' | 'casual';
               notificationPreferences?: {
                    enabled: boolean;
                    types: string[];
               };
               customSettings?: Record<string, any>;
          };
     }) {
          try {
               if (action === 'set' && preferences) {
                    await memory.setPreferences(userId, preferences);
                    return Maybe.just(`Successfully updated preferences for user: ${userId}`);
               } else if (action === 'get') {
                    const userPrefs = memory.getPreferences(userId);
                    return Maybe.just(userPrefs ? JSON.stringify(userPrefs, null, 2) : 'No preferences found');
               }
               return Maybe.just('Invalid action or missing preferences');
          } catch (error) {
               console.error('Error managing preferences:', error);
               return Maybe.just(`Failed to manage preferences: ${error}`);
          }
     }
};

export const get_memory_stats: FunctionRegistry = {
     tool: {
          type: 'function',
          function: {
               name: 'get_memory_stats',
               description: 'Get statistics about the memory system',
               parameters: {
                    type: SchemaType.OBJECT,
                    properties: {},
                    required: [],
               },
          },
     },
     async call() {
          try {
               const stats = memory.getStats();
               return Maybe.just(JSON.stringify(stats, null, 2));
          } catch (error) {
               console.error('Error getting memory stats:', error);
               return Maybe.just(`Failed to get memory statistics: ${error}`);
          }
     }
};