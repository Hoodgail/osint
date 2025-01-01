import yaml from 'yaml';
import fs from 'fs/promises';
import path from 'path';
import { compareTwoStrings } from 'string-similarity';
import { TfIdf, SentenceTokenizer } from 'natural';

interface MemoryEntry {
     content: string;
     timestamp: number;
     metadata: {
          context?: string;
          source?: string;
          type: 'conversation' | 'preference' | 'userData';
          tags?: string[];
     };
     ttl?: number; // Time to live in milliseconds
}

interface MemorySearchResult {
     entry: MemoryEntry;
     similarity: number;
}

export interface UserPreferences {
     language?: string;
     timezone?: string;
     communicationStyle?: 'formal' | 'casual';
     notificationPreferences?: {
          enabled: boolean;
          types: string[];
     };
     customSettings: Record<string, any>;
}

export class EnhancedMemory {
     private memories: Map<string, MemoryEntry> = new Map();
     private preferences: Map<string, UserPreferences> = new Map();
     private tfidf = new TfIdf();
     private readonly basePath: string;
     private readonly memoryFile: string;
     private readonly preferencesFile: string;

     constructor(basePath: string) {
          this.basePath = basePath;
          this.memoryFile = path.join(basePath, 'memories.json');
          this.preferencesFile = path.join(basePath, 'preferences.json');
     }

     /**
      * Initialize the memory system by loading existing data
      */
     async initialize(): Promise<void> {
          try {
               await fs.mkdir(this.basePath, { recursive: true });

               // Load memories
               try {
                    const memoriesData = await fs.readFile(this.memoryFile, 'utf-8');
                    const memoriesArray: [string, MemoryEntry][] = JSON.parse(memoriesData);
                    this.memories = new Map(memoriesArray);
               } catch (error) {
                    // File doesn't exist or is corrupt, start with empty memories
                    this.memories = new Map();
               }

               // Load preferences
               try {
                    const preferencesData = await fs.readFile(this.preferencesFile, 'utf-8');
                    const preferencesArray: [string, UserPreferences][] = JSON.parse(preferencesData);
                    this.preferences = new Map(preferencesArray);
               } catch (error) {
                    // File doesn't exist or is corrupt, start with empty preferences
                    this.preferences = new Map();
               }

               // Initialize TF-IDF with existing memories
               this.memories.forEach((entry, key) => {
                    this.tfidf.addDocument(entry.content, key);
               });

               console.log(`[memory] Initialized with ${this.memories.size} memories and ${this.preferences.size} user preferences`);
          } catch (error) {
               console.error('[memory] Initialization failed:', error);
               throw error;
          }
     }

     /**
      * Store a new memory
      */
     async store(key: string, entry: Omit<MemoryEntry, 'timestamp'>): Promise<void> {
          const fullEntry: MemoryEntry = {
               ...entry,
               timestamp: Date.now()
          };

          this.memories.set(key, fullEntry);
          this.tfidf.addDocument(entry.content, key);

          await this.persist();
     }

     /**
      * Retrieve memories based on context and similarity
      */
     async recall(context: string, options: {
          minSimilarity?: number;
          limit?: number;
          type?: MemoryEntry['metadata']['type'];
     } = {}): Promise<MemorySearchResult[]> {
          const {
               minSimilarity = 0.3,
               limit = 5,
               type
          } = options;

          const now = Date.now();
          const results: MemorySearchResult[] = [];

          this.memories.forEach((entry, key) => {
               // Skip expired memories
               if (entry.ttl && now > entry.timestamp + entry.ttl) {
                    return;
               }

               // Filter by type if specified
               if (type && entry.metadata.type !== type) {
                    return;
               }

               const similarity = compareTwoStrings(context, entry.content);
               if (similarity >= minSimilarity) {
                    results.push({ entry, similarity });
               }
          });

          return results
               .sort((a, b) => b.similarity - a.similarity)
               .slice(0, limit);
     }

     /**
      * Forget a specific memory or memories matching criteria
      */
     async forget(options: {
          key?: string;
          type?: MemoryEntry['metadata']['type'];
          before?: number;
          tags?: string[];
     }): Promise<number> {
          const keysToRemove: string[] = [];

          this.memories.forEach((entry, key) => {
               let shouldRemove = false;

               if (options.key && key === options.key) {
                    shouldRemove = true;
               } else if (options.type && entry.metadata.type === options.type) {
                    shouldRemove = true;
               } else if (options.before && entry.timestamp < options.before) {
                    shouldRemove = true;
               } else if (options.tags && entry.metadata.tags) {
                    shouldRemove = options.tags.some(tag => entry.metadata.tags?.includes(tag));
               }

               if (shouldRemove) {
                    keysToRemove.push(key);
               }
          });

          keysToRemove.forEach(key => {
               this.memories.delete(key);
          });

          // Rebuild TF-IDF index
          this.tfidf = new TfIdf();
          this.memories.forEach((entry, key) => {
               this.tfidf.addDocument(entry.content, key);
          });

          await this.persist();
          return keysToRemove.length;
     }

     /**
      * Store user preferences
      */
     async setPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
          const existing = this.preferences.get(userId) || {
               customSettings: {}
          };

          this.preferences.set(userId, {
               ...existing,
               ...preferences,
               customSettings: {
                    ...existing.customSettings,
                    ...preferences.customSettings
               }
          });

          await this.persist();
     }

     /**
      * Retrieve user preferences
      */
     getPreferences(userId: string): UserPreferences | undefined {
          return this.preferences.get(userId);
     }

     /**
      * Persist all data to disk
      */
     private async persist(): Promise<void> {
          try {
               const memoriesArray = Array.from(this.memories.entries());
               await fs.writeFile(this.memoryFile, JSON.stringify(memoriesArray));

               const preferencesArray = Array.from(this.preferences.entries());
               await fs.writeFile(this.preferencesFile, JSON.stringify(preferencesArray));
          } catch (error) {
               console.error('[memory] Persistence failed:', error);
               throw error;
          }
     }

     /**
      * Get memory statistics
      */
     getStats(): {
          totalMemories: number;
          totalUsers: number;
          memoryTypes: Record<string, number>;
     } {
          const memoryTypes: Record<string, number> = {};

          this.memories.forEach(entry => {
               const type = entry.metadata.type;
               memoryTypes[type] = (memoryTypes[type] || 0) + 1;
          });

          return {
               totalMemories: this.memories.size,
               totalUsers: this.preferences.size,
               memoryTypes
          };
     }
}