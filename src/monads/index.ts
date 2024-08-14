import yaml from 'yaml';
import fs from 'fs/promises';
import path from "path";

import { SemanticSearch } from '../utils/SemanticSearch';

function isArrayOf(arr: string[], type: "string"): arr is string[];
function isArrayOf(arr: number[], type: "number"): arr is number[];
function isArrayOf(arr: boolean[], type: "boolean"): arr is boolean[];
function isArrayOf(arr: any[], type: "object"): arr is any[];
function isArrayOf(arr: any[], type: string): arr is any[];
function isArrayOf(arr: any, type: string) {
     if (!Array.isArray(arr)) {
          return false; // Not an array
     }

     return arr.every(item => typeof item === type);
}

export class Maybe<T> {

     constructor(private value: T | null) { }

     static just<T>(value: T): Maybe<T> {
          return new Maybe(value);
     }

     static nothing<T>(): Maybe<T> {
          return new Maybe<T>(null);
     }

     static string(value: Promise<any>): Promise<Maybe<string>>
     static string(value: Maybe<any>): Maybe<string>
     static string(value: any): Maybe<string>
     static string(value: any | Promise<any> | Maybe<any>): Maybe<string> | Promise<Maybe<string>> {

          if (value instanceof Promise) {

               return value.then(v => Maybe.string(v));
          }

          if (value instanceof Maybe) {

               return value.stringify();

          }

          return new Maybe(value).stringify();
     }

     map<U>(fn: (value: T) => U): Maybe<U> {
          return this.value === null ? Maybe.nothing<U>() : Maybe.just(fn(this.value));
     }

     flatMap<U>(fn: (value: T) => Maybe<U>): Maybe<U>
     flatMap<U>(fn: (value: T) => Promise<Maybe<U>>): Promise<Maybe<U>>
     flatMap<U>(fn: (value: T) => Maybe<U> | Promise<Maybe<U>>): Maybe<U> | Promise<Maybe<U>> {
          return this.value === null ? Maybe.nothing<U>() : fn(this.value);
     }

     getOrElse(defaultValue: T): T
     getOrElse(defaultValue: null): null
     getOrElse(defaultValue: T | null): T | null {
          return this.value === null ? defaultValue : this.value
     }

     stringify() {

          let value: string;

          if (this.value === null) value = "N/A";

          else if (typeof this.value === "string") {

               value = this.value;
          }

          else if (typeof this.value === "number") {

               value = this.value.toString();
          }

          else if (typeof this.value === "boolean") {

               value = this.value ? "Yes" : "No";

          }

          else if (Array.isArray(this.value) && isArrayOf(this.value, "string")) {
               value = this.value.join(", ");
          }

          else if (Array.isArray(this.value) && isArrayOf(this.value, "number")) {
               value = this.value.join(", ");
          }

          else if (Array.isArray(this.value) && isArrayOf(this.value, "boolean")) {
               value = this.value.join(", ");
          }

          else if (typeof this.value === "object") {

               value = yaml.stringify(this.value, null, 2);
          }

          else {

               value = this.value?.toString() ?? "Unknown"
          }

          return new Maybe(value);

     }

     isEmpty(): boolean {
          return this.value === null || this.value === "N/A" || this.value === "" || this.value === undefined || this.value === false;
     }
}


export class Cache<T> {

     private cache: Map<string, T> = new Map;

     async create<V extends T = T>(key: string, fetcher: () => Promise<V>): Promise<V> {

          if (this.cache.has(key)) return Promise.resolve(
               this.cache.get(key) as V
          );

          console.time(`[cache: ${key}]`);

          return fetcher().then(data => {

               this.cache.set(key, data);

               console.timeEnd(`[cache: ${key}]`);

               return data;
          });
     }

}

export class Memory {

     private readonly cache: Map<string, string> = new Map;

     private readonly length: Map<string, number> = new Map;     // Length of each document

     constructor(
          private readonly path: string
     ) {

     }

     async load() {

          console.time("[memory: read]");

          const files = await fs.readdir(this.path);

          for (let file of files) {

               const location = path.join(this.path, file);

               const raw = await fs.readFile(location, 'utf-8');

               const data = decodeURIComponent(raw);

               this.cache.set(file, data);

               this.length.set(file, data.length);

          }

          console.timeEnd("[memory: read]");

          // Sum of all document lengths
          const lengths = Array.from(this.length.values()).reduce((a, b) => a + b, 0);

          console.log(`[memory: load] ${lengths} characters in ${this.length.size} documents`);

          return this;
     }

     async set(key: string, value: string, append: boolean = false) {

          const location = path.join(this.path, key);

          if (append) {

               await fs.appendFile(location, encodeURIComponent(value));

               const cache = this.cache.get(key) ?? "";
               const length = this.length.get(key) ?? 0;

               this.cache.set(key, cache + value);

               this.length.set(key, length + value.length);

          } else {

               await fs.writeFile(location, encodeURIComponent(value));

               this.cache.set(key, value);

               this.length.set(key, value.length);

          }

          // Sum of all document lengths
          const lengths = Array.from(this.length.values()).reduce((a, b) => a + b, 0);

          const response = `[memory: append] +${value.length} characters added to "${key}" (${lengths} characters in ${this.length.size} documents)`;

          console.log(response);

          return Maybe.just(response);
     }

     public put(key: string, value: string, append: boolean = false) {

          if (append && this.cache.has(key)) {

               const cache = this.cache.get(key) ?? "";
               const length = this.length.get(key) ?? 0;

               this.cache.set(key, cache + value);

               this.length.set(key, length + value.length);

          } else {

               this.cache.set(key, value);

               this.length.set(key, value.length);

          }

     }

     async get(context: string): Promise<Maybe<string>> {

          const segments = Array.from(this.cache.entries()).map(entry => `${entry[0]}: ${entry[1]}`);

          const search = new SemanticSearch(segments);

          const results = search.search(context, 5)
               .filter(result => result.similarity >= 0.5)
               .map(result => result.section);

          if (results.length == 0) return Maybe.nothing<string>();

          return Maybe.just(results.join("\n"));

     }


}