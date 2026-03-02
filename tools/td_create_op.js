import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Create TouchDesigner Operator",
  description: "Create a new operator inside a parent component",
  inputSchema: {
    parent: z.string().describe("Parent COMP path"),
    type: z.string().describe("Operator type (e.g., noiseTOP, constantCHOP)"),
    name: z.string().optional().describe("Operator name")
  }
};

export async function handler({ parent, type, name }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "create_op",
      data: { parent, type, name }
    });
    return textResponse(formatJsonBlock("Operator Created", result));
  } catch (error) {
    return textResponse(`td_create_op failed: ${error.message}`);
  }
}