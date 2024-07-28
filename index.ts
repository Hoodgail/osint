

import * as defaults from "./src/ai/functions"
import * as intergrations from "./src/ai/functions/intergrations"

import { processAI } from "./src/ai"

const registry = [
     ...Object.values(defaults),
     ...Object.values(intergrations)
];


console.log(
     registry.map(def => def.tool).map(tool => tool.function.name)
)

processAI({
     context: void 0,
     input: "Who's Hoodgail on github?",
     tools: registry.map(def => def.tool),
     registry: registry.reduce((acc, def) => ({ ...acc, [def.tool.function.name]: def.call }), {})
}).then((response) => {

     console.debug(response);

     console.timeEnd("process");
})
