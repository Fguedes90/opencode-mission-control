import { MissionManager } from "../../core/MissionManager.ts";
import { getContextMissionId } from "../../utils/context.ts";

type MissionCommand = "create" | "update" | "link" | "claim" | "query";

interface MissionControlPayload {
    // CREATE
    title?: string;
    description?: string;
    priority?: number;
    acceptance_criteria?: string;

    // UPDATE / CLAIM / LINK
    task_id?: string;
    agent_id?: string; // for claim
    status?: "pending" | "in_progress" | "completed" | "failed";
    result_summary?: string;
    target_task_id?: string; // used for linking: task_id blocks target_task_id

    // QUERY
    view?: "ready" | "all" | "active";
    limit?: number;
}

interface MissionControlArgs {
    command: MissionCommand;
    payload: MissionControlPayload;
}

export const mission_control = {
    name: "mission_control",
    description: `The BRAIN of the project. Use this tool to Read (query) and Write (create, update, link) tasks in the Mission Control graph.

CRITICAL:
- THINK IN GRAPHS: Break work into atomic tasks and LINK them (Blocker -> Blocked).
- "Empty State" Strategy: If 'query' returns no ready tasks, your job is to CREATE the plan.
- ATOMIC LOOP: Claim -> Work -> Update. Never work on a task without claiming it.

Commands:
- 'create': Create a new task. Payload: { title (req), description, priority (1-5) }.
- 'update': Update task status. Payload: { task_id (req), status (req), result_summary }.
- 'link': Define dependency. Payload: { task_id (BLOCKER), target_task_id (BLOCKED) }.
 - 'claim': Lock a task. Payload: { task_id (req), agent_id (req) }.
- 'query': Fetch tasks. Payload: { view: 'ready' | 'all' | 'active', limit }. ('ready' = runnable now).
`,
    parameters: {
        type: "object",
        properties: {
            command: {
                type: "string",
                enum: ["create", "update", "link", "claim", "query"],
                description: "The operation to perform"
            },
            payload: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    acceptance_criteria: { type: "string" },
                    priority: { type: "number" },
                    task_id: { type: "string" },
                    agent_id: { type: "string", description: "Agent ID for claiming tasks" },
                    status: { type: "string", enum: ["pending", "in_progress", "completed", "failed"] },
                    result_summary: { type: "string" },
                    target_task_id: { type: "string" },
                    view: { type: "string", enum: ["ready", "all", "active"] },
                    limit: { type: "number" }
                }
            }
        },
        required: ["command", "payload"],
    },
    handler: async (
        manager: MissionManager,
        { command, payload }: MissionControlArgs
    ) => {
        const missionId = getContextMissionId();

        switch (command) {
            case "create": {
                if (!payload.title) throw new Error("Title is required for create command");
                const task = manager.createTask(
                    missionId,
                    payload.title,
                    payload.description || "",
                    payload.priority || 4,
                    payload.acceptance_criteria
                );
                return { success: true, data: task };
            }

            case "update": {
                if (!payload.task_id || !payload.status) throw new Error("task_id and status required for update");
                const task = manager.updateTaskStatus(payload.task_id, payload.status as any, payload.result_summary);
                return { success: true, data: task };
            }

            case "link": {
                if (!payload.task_id || !payload.target_task_id) throw new Error("task_id (blocker) and target_task_id (blocked) required for link");
                await manager.linkTasks(payload.task_id, payload.target_task_id);
                return { success: true, message: `Linked ${payload.task_id} -> ${payload.target_task_id}` };
            }

            case "claim": {
                if (!payload.task_id || !payload.agent_id) throw new Error("task_id and agent_id required for claim");
                const task = manager.claimTask(payload.task_id, payload.agent_id);
                return { success: true, data: task };
            }

            case "query": {
                const view = payload.view || "ready";
                const limit = payload.limit || 50;
                let tasks: any[] = [];

                if (view === "ready") {
                    tasks = manager.getReadyTasks(missionId, limit);
                } else if (view === "all") {
                    tasks = manager.getAllTasks(missionId);
                } else if (view === "active") {
                    tasks = manager.getActiveTasks(missionId);
                } else {
                    return { success: false, message: `View '${view}' not supported` };
                }

                // Format as Rich Markdown Report
                const report = tasks.map(t => {
                    const deps = manager.getDependencies(t.id);
                    return `
🆔 **${t.id}** | 🚦 ${t.status.toUpperCase()} | 🚨 P${t.priority}
Title: ${t.title}
${t.acceptance_criteria ? `✅ Criteria: ${t.acceptance_criteria}` : ''}
${t.description ? `📝 ${t.description}` : ''}
    `.trim();
                }).join('\n\n---\n\n');

                const header = `## Mission Control Report: ${view.toUpperCase()} (${tasks.length} tasks)\n`;

                return {
                    success: true,
                    count: tasks.length,
                    data: tasks, // Keep raw data for programmatic use
                    message: header + (tasks.length > 0 ? report : "No tasks found.")
                };
            }

            default:
                throw new Error(`Unknown command: ${command}`);
        }
    },
};
