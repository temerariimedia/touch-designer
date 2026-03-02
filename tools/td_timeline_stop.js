import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Stop TouchDesigner Timeline",
  description: "Stop timeline playback in TouchDesigner",
  inputSchema: {}
};

export async function handler(_params, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({ tdBridgeClient, action: "timeline_stop" });
    return textResponse(formatJsonBlock("Timeline Stopped", result));
  } catch (error) {
    return textResponse(`td_timeline_stop failed: ${error.message}`);
  }
}