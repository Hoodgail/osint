import yaml from 'yaml';

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

     private constructor(private value: T | null) { }

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