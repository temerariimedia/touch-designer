import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Get TouchDesigner Status",
  description: "Get runtime status from the connected TouchDesigner bridge",
  inputSchema: {}
};

export async function handler(_params, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({ tdBridgeClient, action: "get_status" });
    return textResponse(formatJsonBlock("TouchDesigner Status", result));
  } catch (error) {
    return textResponse(`Failed to retrieve TouchDesigner status: ${error.message}`);
  }
}