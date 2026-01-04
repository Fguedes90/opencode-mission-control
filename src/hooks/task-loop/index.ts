import { MissionManager } from "../../core/MissionManager";
import { getContextMissionId } from "../../utils/context";
import { CONTINUATION_PROMPT } from "./constants";
import * as fs from "fs";
import * as path from "path";

export const createSessionIdleHook = (missionManager: MissionManager, client: any) => async (event: any) => {
    // 0. Safety checks
    if (!client) return;

    // 1. Configuration Check
    try {
        const configPath = path.join(process.cwd(), "opencode.json");
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            const enableFeedback = config.mission_control?.enable_feedback_loop ?? true; // Default true
            if (!enableFeedback) {
                return;
            }
        }
    } catch (e) {
        console.error("[Mission Control] Failed to read config:", e);
        // Continue if config fails, assuming default true? Or safe fail?
        // Let's assume enabled if config is broken or missing keys, but log error.
    }

    // 2. Mission Context Check
    // We need to know which mission we are in.
    // The event might have session info.
    const missionId = getContextMissionId();
    // Note: getContextMissionId() uses process.env or similar?
    // If it relies on a specific context that might not be set in idle event, we might need to look at event.

    try {
        // 3. Check for Incomplete Tasks
        const tasks = missionManager.getAllTasks(missionId);
        const incompleteTasks = tasks.filter(t =>
            (t.status === 'pending' || t.status === 'in_progress') &&
            !t.metadata?.background_runner // Exclude tasks being handled by background runner
        );

        if (incompleteTasks.length === 0) {
            return;
        }

        console.log(`[Mission Control] Found ${incompleteTasks.length} incomplete tasks. Initiating feedback loop.`);

        // 4. Wait and Prompt
        // 2 second delay as requested
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Inject prompt
        // Using event.session.id if available, otherwise we might need to find it ??
        // The event structure for session.idle usually implies a session context.
        // Assuming event.session or we use the client to prompt active session?
        // Let's check how 'session.created' used 'session.id'.

        const sessionId = event.session?.id;
        if (!sessionId) {
            console.warn("[Mission Control] No session ID in idle event");
            return;
        }

        await client.session.prompt({
            path: { id: sessionId },
            body: {
                agent: "user", // Impersonate user or system? User request said "finge ser o usuário" (pretend to be user)
                parts: [{ type: "text", text: CONTINUATION_PROMPT }],
            },
            query: { directory: process.cwd() } // ctx.directory equivalent
        });

    } catch (e) {
        console.error("[Mission Control] Feedback loop error:", e);
    }
};
