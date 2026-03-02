import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Save TouchDesigner Project",
  description: "Save the current TouchDesigner project (or save as a new file)",
  inputSchema: {
    file: z.string().optional().describe("Optional file path for Save As")
  }
};

export async function handler({ file }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "save_project",
      data: { file },
      timeoutMs: 120000
    });
    return textResponse(formatJsonBlock("Project Saved", result));
  } catch (error) {
    return textResponse(`td_save_project failed: ${error.message}`);
  }
}