import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Evaluate TouchDesigner Python Expression",
  description: "Evaluate a Python expression in the connected TouchDesigner instance",
  inputSchema: {
    expression: z.string().describe("Python expression to evaluate"),
    timeout_ms: z.number().int().positive().max(120000).optional().describe("Request timeout in milliseconds")
  }
};

export async function handler({ expression, timeout_ms = 5000 }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "eval",
      data: { expression },
      timeoutMs: timeout_ms
    });
    return textResponse(formatJsonBlock("TouchDesigner Eval Result", result));
  } catch (error) {
    return textResponse(`td_eval failed: ${error.message}`);
  }
}