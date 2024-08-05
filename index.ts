


import * as defaults from "./src/ai/functions"
import * as intergrations from "./src/ai/functions/intergrations"

import { JaroWinklerDistance } from "natural"

import { processAI } from "./src/ai"

const registry = [
     ...Object.values(defaults),
     ...Object.values(intergrations)
];

console.log("Loaded AI functions:");

console.time("process");

console.log(
     JaroWinklerDistance("zhiyan114", "zayan")
)

console.timeEnd("process");

console.log(
     registry.map(def => def.tool).map(tool => tool.function.name).join(', ')
);

process.exit(1)

processAI({
     context: void 0,
     input: "Ask lemons0 on discord if infora.io is almost ready to be released.",
     tools: registry.map(def => def.tool),
     registry: registry.reduce((acc, def) => ({ ...acc, [def.tool.function.name]: def.call }), {})
}).then((response) => {

     console.debug(response);

     console.timeEnd("process");
})
