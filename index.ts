


import * as defaults from "./src/ai/functions"
import * as intergrations from "./src/ai/functions/intergrations"

import { JaroWinklerDistance } from "natural"

import { processAI } from "./src/ai"

const registry = [
     ...Object.values(defaults),
     ...Object.values(intergrations)
];

// console.log(
//      registry.map(def => def.tool).map(tool => tool.function.name).join(', ')
// );

console.log("[functions]", registry.length, "registered");

// process.exit(1)

console.time("process");

processAI({
     context: void 0,
     input: "How old is lissa?",
     tools: registry.map(def => def.tool),
     registry: registry.reduce((acc, def) => ({ ...acc, [def.tool.function.name]: def.call }), {})
}).then((response) => {

     console.debug(response);

     console.timeEnd("process");
})
