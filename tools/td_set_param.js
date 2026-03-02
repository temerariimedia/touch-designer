import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Set TouchDesigner Parameter",
  description: "Set a parameter value on a TouchDesigner operator",
  inputSchema: {
    path: z.string().describe("Operator path (e.g., /project1/noise1)"),
    param: z.string().describe("Parameter name"),
    value: z.union([z.string(), z.number(), z.boolean()]).describe("Parameter value")
  }
};

export async function handler({ path, param, value }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "set_param",
      data: { path, param, value }
    });
    return textResponse(formatJsonBlock("Parameter Updated", result));
  } catch (error) {
    return textResponse(`td_set_param failed: ${error.message}`);
  }
}