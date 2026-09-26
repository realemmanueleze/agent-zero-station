import { tool } from "@langchain/core/tools";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { createDeepAgent } from "deepagents";
import { z } from "zod";
import { LIVE_TOOL_NAMES } from "./tools.ts";

const DENIED = new Set([
  "ls",
  "read_file",
  "write_file",
  "edit_file",
  "glob",
  "grep",
  "execute",
  "task",
  "commit_send",
  "approveWithConnection",
  "escalate",
]);

const empty = z.object({});

function stationTool(name: (typeof LIVE_TOOL_NAMES)[number], run: () => string) {
  return tool(async () => {
    if (guardToolCall(name, () => undefined) === "denied") {
      return "denied";
    }
    return run();
  }, {
    name,
    description: name,
    schema: empty,
  });
}

export function drafterToolNames(): string[] {
  return [...LIVE_TOOL_NAMES];
}

export function guardToolCall(name: string, send: () => void): "denied" | "ok" {
  if (DENIED.has(name)) {
    return "denied";
  }
  void send;
  return "ok";
}

function liveTools() {
  return [
    stationTool("read_signal", () => "signal"),
    stationTool("search_ledger", () => "ledger"),
    stationTool("draft_reply", () => "draft"),
    stationTool("query_db", () => "rows"),
    stationTool("vault_search", () => "vault"),
    stationTool("escalate", () => "held"),
    stationTool("drop", () => "dropped"),
  ];
}

export function fakeDraftModel(): BaseLanguageModel {
  return new FakeListChatModel({ responses: ["FAKE DRAFT"] });
}

export async function draftWithAgent(input: {
  node: string;
  text: string;
  model: BaseLanguageModel;
}): Promise<string> {
  const agent = await createDeepAgent({
    model: input.model,
    tools: liveTools(),
    systemPrompt: "Draft only. Do not send.",
    permissions: [{ operations: ["read", "write"], paths: ["/**"], mode: "deny" }],
  });
  const result = await agent.invoke({
    messages: [{ role: "user", content: `${input.node}\n${input.text}` }],
  });
  const messages = result.messages as Array<{ content?: unknown }>;
  const last = messages[messages.length - 1];
  return typeof last?.content === "string" ? last.content : "";
}
