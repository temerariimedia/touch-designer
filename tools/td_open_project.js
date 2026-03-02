import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Open TouchDesigner Project",
  description: "Open a .toe project file in TouchDesigner",
  inputSchema: {
    file: z.string().describe("Path to the .toe file")
  }
};

export async function handler({ file }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "open_project",
      data: { file },
      timeoutMs: 120000
    });
    return textResponse(formatJsonBlock("Project Opened", result));
  } catch (error) {
    return textResponse(`td_open_project failed: ${error.message}`);
  }
}