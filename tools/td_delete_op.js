import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Delete TouchDesigner Operator",
  description: "Delete an operator from TouchDesigner",
  inputSchema: {
    path: z.string().describe("Operator path to delete")
  }
};

export async function handler({ path }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "delete_op",
      data: { path }
    });
    return textResponse(formatJsonBlock("Operator Deleted", result));
  } catch (error) {
    return textResponse(`td_delete_op failed: ${error.message}`);
  }
}