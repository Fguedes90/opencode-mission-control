import { MissionStore } from "./persistence/MissionStore.ts";
import { MissionManager } from "./core/MissionManager.ts";
import { registerTools } from "./tools/index.ts";
import { getContextMissionId, getContextMissionTitle } from "./utils/context.ts";
import * as fs from "fs";
import * as path from "path";

const agentGuidelines = `
# Mission Control: Agent Best Practices Guide

You are an intelligent agent operating within the **Mission Control** system. This system is your brain and memory. To be efficient, organized, and effective, you must follow these guidelines.

## Core Philosophy: "Think in Graphs"
Do not just execute linear steps. Visualize your work as a **Directed Acyclic Graph (DAG)** of tasks.
- **Break it down**: Big goals must be split into smaller, atomic tasks.
- **Link them up**: If Task B needs the output of Task A, **Task A blocks Task B**.
- **Respect the Flow**: Never start a task that is blocked.

## The Golden Workflow

### 1. START: Ground Yourself
When you wake up, your first action should always be to see what is ready for you.
\`\`\`json
// Tool: mission_control
{ "command": "query", "payload": { "view": "ready" } }
\`\`\`

### 2. PLAN: The "Empty State" Strategy
If the query returns **empty** (no ready tasks), it means either:
- The project is done.
- OR, nothing has been planned yet.

**Action**: Create a plan using the DAG pattern.
1.  **Create** the end-goal task (e.g., "Deploy App").
2.  **Create** the dependency tasks (e.g., "Build App", "Configure Server").
3.  **Link** them immediately: \`Link(Blocker: "Build App", Blocked: "Deploy App")\`.

**Anti-Pattern**: keeping the plan only in your context window. *If it's not in Mission Control, it doesn't exist.*

### 3. EXECUTE: The Atomic Loop
Once you have \`ready\` tasks:
1.  **CLAIM**: Lock the task so no one else touches it.
    \`\`\`json
    { "command": "claim", "payload": { "task_id": "123" } }
    \`\`\`
2.  **WORK**: Do the actual coding/analysis.
3.  **UPDATE**:
    - **Success**: Mark \`completed\`. This automatically unblocks downstream tasks.
    - **Failure**: Mark \`failed\`. This stops the chain and alerts the user.
    \`\`\`json
    { "command": "update", "payload": { "task_id": "123", "status": "completed", "result_summary": "API endpoint created" } }
    \`\`\`
`;

export const missionControlPlugin = async ({ client }: { client: any }) => {
    // Initialize persistence
    // In production this would likely be a fixed path in .opencode
    const store = new MissionStore();

    // Initialize logic core
    const missionManager = new MissionManager(store);

    // Force context init
    const missionId = getContextMissionId();
    console.log(`[Mission Control] Initialized for context: ${missionId}`);

    // Ensure mission exists
    try {
        if (!store.getMission(missionId)) {
            missionManager.createMission(missionId, "Auto-Initialized Mission");
        }
    } catch (e) {
        // Ignore if exists (race condition safe or if logic changes)
    }

    // Auto-Setup: Create opencode.json if not exists
    try {
        const configPath = path.join(process.cwd(), "opencode.json");
        if (!fs.existsSync(configPath)) {
            console.log("[Mission Control] Auto-Setup: Creating default opencode.json");
            const defaultConfig = {
                "$schema": "https://opencode.ai/config.json",
                "tools": {
                    "todoread": false,
                    "todowrite": false
                }
            };
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        }
    } catch (e) {
        console.error("[Mission Control] Auto-Setup Failed:", e);
    }

    // Register tools with the manager dependency
    const tools = registerTools(missionManager);

    return {
        name: "opencode-mission-control",
        services: {
            missionManager
        },
        tools,
        hooks: {
            "session.created": async ({ session }: { session: any }) => {
                try {
                    await client.session.prompt({
                        path: { id: session.id },
                        body: {
                            noReply: true,
                            parts: [{ type: "text", text: agentGuidelines }]
                        }
                    });
                } catch (error) {
                    console.error("[Mission Control] Failed to inject system prompt:", error);
                }
            },
            "tool.execute.before": async (input: any) => {
                const blockedTools = new Set(["todoread", "todowrite"]);
                if (blockedTools.has(input.tool)) {
                    throw new Error(`🚫 **Tool Disabled**: '${input.tool}' is disabled in this project. Please use 'mission_control' to manage tasks and context.`);
                }
            }
        }
    };
};
