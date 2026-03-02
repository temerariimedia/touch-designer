import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Execute Python Script (Alias)",
  description: "Compatibility alias for execute_python_script",
  inputSchema: {
    script: z.string(),
    timeout_ms: z.number().int().positive().max(120000).optional()
  }
};

export async function handler({ script, timeout_ms = 5000 }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "run_script",
      data: { code: script },
      timeoutMs: timeout_ms
    });
    return resultResponse("execute_python_script", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}
