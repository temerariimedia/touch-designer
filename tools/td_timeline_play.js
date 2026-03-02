import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Play TouchDesigner Timeline",
  description: "Start timeline playback in TouchDesigner",
  inputSchema: {}
};

export async function handler(_params, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({ tdBridgeClient, action: "timeline_play" });
    return textResponse(formatJsonBlock("Timeline Playing", result));
  } catch (error) {
    return textResponse(`td_timeline_play failed: ${error.message}`);
  }
}