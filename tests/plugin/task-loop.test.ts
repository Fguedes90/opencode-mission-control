import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { createSessionIdleHook } from "../../src/hooks/task-loop/index";
import { MissionManager } from "../../src/core/MissionManager";
import * as fs from "fs";
import * as path from "path";

// Mock dependencies
const mockClient = {
    session: {
        prompt: mock(() => Promise.resolve())
    }
};

const mockMissionManager = {
    getAllTasks: mock((missionId: string) => []),
    // Add other methods if needed
} as unknown as MissionManager;

// Mock context utils for this specific test file
mock.module("../../src/utils/context", () => ({
    getContextMissionId: () => "test-mission-id"
}));

describe("Session Idle Hook", () => {
    const configPath = path.join(process.cwd(), "opencode.json");
    let originalConfig: string | null = null;

    // Helper to write config
    const writeConfig = (config: any) => {
        fs.writeFileSync(configPath, JSON.stringify(config));
    };

    beforeEach(() => {
        if (fs.existsSync(configPath)) {
            originalConfig = fs.readFileSync(configPath, "utf-8");
        }
        mockClient.session.prompt.mockClear();
        // Reset mock implementations if needed
    });

    afterEach(() => {
        if (originalConfig !== null) {
            fs.writeFileSync(configPath, originalConfig);
        } else if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
    });

    it("should do nothing if disabled in config", async () => {
        writeConfig({ mission_control: { enable_feedback_loop: false } });

        const hook = createSessionIdleHook(mockMissionManager, mockClient);
        await hook({ session: { id: "sess-1" } });

        expect(mockClient.session.prompt).not.toHaveBeenCalled();
    });

    it("should do nothing if no incomplete tasks", async () => {
        writeConfig({ mission_control: { enable_feedback_loop: true } });
        // Mock no tasks
        (mockMissionManager.getAllTasks as any).mockReturnValue([
            { id: "t1", status: "completed" }
        ]);

        const hook = createSessionIdleHook(mockMissionManager, mockClient);
        await hook({ session: { id: "sess-1" } });

        expect(mockClient.session.prompt).not.toHaveBeenCalled();
    });

    it("should prompt if there are incomplete tasks", async () => {
        writeConfig({ mission_control: { enable_feedback_loop: true } });
        // Mock pending task
        (mockMissionManager.getAllTasks as any).mockReturnValue([
            { id: "t1", status: "pending" }
        ]);

        const hook = createSessionIdleHook(mockMissionManager, mockClient);

        // We expect it to wait 2s, but we don't want to wait in tests.
        // For unit test, we might want to mock setTimeout or just accept the delay (2s is tolerable)
        // Or we can mock global.setTimeout if bun supports it easily, but let's just run it.
        const start = Date.now();
        await hook({ session: { id: "sess-1" } });
        const end = Date.now();

        expect(end - start).toBeGreaterThanOrEqual(1900); // Allow some slack
        expect(mockClient.session.prompt).toHaveBeenCalled();
        const lastCall = mockClient.session.prompt.mock.lastCall;
        expect(lastCall).toBeDefined();
        expect(Array.isArray(lastCall)).toBe(true);
        expect(lastCall!.length).toBeGreaterThan(0);
        const callArgs = (lastCall as any[])[0];
        expect(callArgs).toBeDefined();
        expect(callArgs.path.id).toBe("sess-1");
        expect(callArgs.body.parts[0].text).toContain("Incomplete tasks remain");
    });

    it("should not prompt if only background runner tasks are incomplete", async () => {
        writeConfig({ mission_control: { enable_feedback_loop: true } });
        // Mock pending task with background_runner metadata
        (mockMissionManager.getAllTasks as any).mockReturnValue([
            { id: "t1", status: "pending", metadata: { background_runner: true } }
        ]);

        const hook = createSessionIdleHook(mockMissionManager, mockClient);
        await hook({ session: { id: "sess-1" } });

        expect(mockClient.session.prompt).not.toHaveBeenCalled();
    });
});
