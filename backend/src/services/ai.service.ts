import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";

const getClient = () => {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured on this server.");
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
};

const extractJson = (raw: string) => raw.replace(/```json\n?|\n?```|```\n?/g, "").trim();

export type GeneratedTask = {
  title: string;
  description: string;
  type: "EPIC" | "STORY" | "TASK" | "BUG";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "BACKLOG";
  storyPoints: number | null;
  daysFromNow: number | null;
};

export type ParsedVoiceTask = {
  title: string;
  description: string;
  type: "EPIC" | "STORY" | "TASK" | "BUG";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "TODO";
  assigneeName: string | null;
  daysUntilDue: number | null;
};

export async function generateProjectPlan(
  projectName: string,
  description: string,
  teamSize: number,
  durationDays: number,
): Promise<GeneratedTask[]> {
  const client = getClient();

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a senior agile project manager. Create a realistic sprint task plan.

Project: ${projectName}
Description: ${description}
Team size: ${teamSize} developer(s)
Timeline: ${durationDays} days

IMPORTANT: Write all task titles and descriptions in the SAME language as the Description above. If the description is in Mongolian, write in Mongolian. If English, write in English. Match the language exactly.

Return ONLY a valid JSON array (no markdown, no text outside the array) of 8-14 tasks:
[{"title":"string max 60 chars","description":"string max 120 chars","type":"EPIC|STORY|TASK|BUG","priority":"LOW|MEDIUM|HIGH|CRITICAL","status":"BACKLOG","storyPoints":1-13 or null,"daysFromNow":integer spread across ${durationDays} days}]

Rules: Begin with 1-2 EPICs, break into STORYs and TASKs. Spread due dates evenly. First tasks have smaller daysFromNow values.`,
      },
    ],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "[]";
  return JSON.parse(extractJson(raw)) as GeneratedTask[];
}

export async function parseVoiceToTask(transcript: string): Promise<ParsedVoiceTask> {
  const client = getClient();
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Parse this voice command into a task. Today is ${today}.

Voice: "${transcript}"

IMPORTANT: Write the title and description in the SAME language as the voice command. If the voice is in Mongolian, respond in Mongolian. Match the language exactly.

Return ONLY valid JSON (no markdown, no extra text):
{"title":"task title max 80 chars","description":"expanded description 20-200 chars","type":"EPIC|STORY|TASK|BUG","priority":"LOW|MEDIUM|HIGH|CRITICAL","status":"TODO","assigneeName":"name or null","daysUntilDue":integer or null}

Rules: Infer type from context. Map urgency words to priority (asap/critical→CRITICAL, urgent/high→HIGH). Parse relative dates (tomorrow=1, next week=7, next Friday=days until that day). Extract assignee name if mentioned.`,
      },
    ],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  return JSON.parse(extractJson(raw)) as ParsedVoiceTask;
}
