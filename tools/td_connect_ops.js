import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Connect TouchDesigner Operators",
  description: "Connect output of one operator into another operator",
  inputSchema: {
    out: z.string().describe("Output operator path"),
    into: z.string().describe("Input operator path"),
    index: z.number().int().min(0).optional().describe("Input index")
  }
};

export async function handler({ out, into, index = 0 }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "connect_ops",
      data: { out, into, index }
    });
    return textResponse(formatJsonBlock("Operators Connected", result));
  } catch (error) {
    return textResponse(`td_connect_ops failed: ${error.message}`);
  }
}