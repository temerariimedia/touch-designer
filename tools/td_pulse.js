import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Pulse TouchDesigner Parameter",
  description: "Pulse a pulse-type parameter on a TouchDesigner operator",
  inputSchema: {
    path: z.string().describe("Operator path"),
    param: z.string().describe("Pulse parameter name")
  }
};

export async function handler({ path, param }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "pulse",
      data: { path, param }
    });
    return textResponse(formatJsonBlock("Parameter Pulsed", result));
  } catch (error) {
    return textResponse(`td_pulse failed: ${error.message}`);
  }
}