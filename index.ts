

import * as defaults from "./src/ai/functions"
import { processAI } from "./src/ai"

processAI({
     context: void 0,
     input: "What socials does Hoodgail have?",
     tools: Object.values(defaults).map(def => def.tool),
     registry: Object.values(defaults).reduce((acc, def) => ({ ...acc, [def.tool.function.name]: def.call }), {})
}).then(console.log)

