process.stdin.on("data", (chunk) => {
  const text = chunk.toString("utf8");
  if (!text.includes("initialize")) {
    return;
  }
  const result = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      serverInfo: { name: "fixture", version: "0" },
    },
  });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(result)}\r\n\r\n${result}`);
  process.exit(0);
});
