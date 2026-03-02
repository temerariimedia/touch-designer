import { z } from "zod";
import { resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Describe TouchDesigner Tools",
  description: "List available TouchDesigner control tools, aliases, and required capabilities",
  inputSchema: {
    filter: z.string().optional().describe("Optional keyword filter")
  }
};

export async function handler({ filter }, { tdToolCatalog }) {
  try {
    const keyword = filter ? filter.toLowerCase() : null;
    const tools = (tdToolCatalog || []).filter((tool) => {
      if (!keyword) {
        return true;
      }
      return tool.name.toLowerCase().includes(keyword)
        || (tool.aliasOf || "").toLowerCase().includes(keyword)
        || (tool.description || "").toLowerCase().includes(keyword);
    });

    return resultResponse("TouchDesigner Tool Catalog", {
      total: tools.length,
      tools
    });
  } catch (error) {
    return errorResponse(error.message);
  }
}

