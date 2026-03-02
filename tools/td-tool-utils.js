export function textResponse(text) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}

export function resultResponse(title, data, meta = {}) {
  return textResponse(formatJsonBlock(title, {
    success: true,
    data,
    meta
  }));
}

export function errorResponse(message, details = null) {
  return textResponse(formatJsonBlock("TouchDesigner Tool Error", {
    success: false,
    error: {
      message,
      details
    }
  }));
}

export async function runBridgeAction({
  tdBridgeClient,
  action,
  data = {},
  timeoutMs = 5000
}) {
  if (!tdBridgeClient) {
    throw new Error("Bridge client unavailable");
  }
  return await tdBridgeClient.send(action, data, timeoutMs);
}

export function formatJsonBlock(title, data) {
  return `# ${title}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}
