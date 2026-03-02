import { z } from "zod";
import { formatJsonBlock, runBridgeAction, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Disconnect from TouchDesigner Bridge",
  description: "Disconnect from the TouchDesigner WebSocket bridge",
  inputSchema: {}
};

export async function handler(_params, { tdBridgeClient }) {
  try {
    const status = await tdBridgeClient.disconnect();
    return textResponse(formatJsonBlock("TouchDesigner Bridge Disconnected", status));
  } catch (error) {
    return textResponse(`Failed to disconnect from TouchDesigner bridge: ${error.message}`);
  }
}