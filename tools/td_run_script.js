import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Run TouchDesigner Python Script",
  description: "Execute Python code in the connected TouchDesigner instance",
  inputSchema: {
    code: z.string().describe("Python code to execute"),
    timeout_ms: z.number().int().positive().max(120000).optional().describe("Request timeout in milliseconds")
  }
};

export async function handler({ code, timeout_ms = 5000 }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "run_script",
      data: { code },
      timeoutMs: timeout_ms
    });
    return textResponse(formatJsonBlock("TouchDesigner Script Result", result));
  } catch (error) {
    return textResponse(`td_run_script failed: ${error.message}`);
  }
}