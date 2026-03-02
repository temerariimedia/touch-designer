import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Get TouchDesigner Operator Info",
  description: "Get metadata and useful details about a TouchDesigner operator",
  inputSchema: {
    path: z.string().describe("Operator path")
  }
};

export async function handler({ path }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "op_info",
      data: { path }
    });
    return textResponse(formatJsonBlock("Operator Info", result));
  } catch (error) {
    return textResponse(`td_op_info failed: ${error.message}`);
  }
}