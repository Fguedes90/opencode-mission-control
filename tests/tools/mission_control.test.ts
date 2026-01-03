import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { MissionStore } from "../../src/persistence/MissionStore";
import { MissionManager } from "../../src/core/MissionManager";
import { mission_control } from "../../src/tools/implementations/mission_control";
import { getContextMissionId } from "../../src/utils/context";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";

describe("Tool: mission_control", () => {
    const TEST_DB_PATH = join(import.meta.dir, `../../temp_test_mc_bdd_${Math.random().toString(36).slice(2)}.sqlite`);
    let store: MissionStore;
    let manager: MissionManager;
    let missionId: string;

    beforeEach(() => {
        store = new MissionStore(TEST_DB_PATH);
        manager = new MissionManager(store);
        missionId = getContextMissionId();
        manager.createMission(missionId, "Unified Context");
    });

    afterEach(() => {
        try { if (store) store.close(); } catch (e) { }
        [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach(p => {
            if (existsSync(p)) { try { unlinkSync(p); } catch (e) { } }
        });
    });

    it("should handle 'create' command", async () => {
        const result = await mission_control.handler(manager, {
            command: "create",
            payload: { title: "Unified Task", priority: 4 }
        });
        expect(result.success).toBe(true);
        const task = result.data as any; // Cast to any or Task to access properties
        expect(task.title).toBe("Unified Task");
        expect(task.mission_id).toBe(missionId);
        expect(task.id).toMatch(/^[a-z]{2}-[a-f0-9]{4}$/); // Expect Smart ID format: xx-1234
    });

    it("should handle 'link' command", async () => {
        const t1 = manager.createTask(missionId, "Blocker");
        const t2 = manager.createTask(missionId, "Blocked");

        const result = await mission_control.handler(manager, {
            command: "link",
            payload: { task_id: t1.id, target_task_id: t2.id }
        });

        expect(result.success).toBe(true);
        const deps = store.getDependencies(t2.id);
        expect(deps).toContain(t1.id);
    });

    it("should handle 'update' command", async () => {
        const t1 = manager.createTask(missionId, "Task to Update");

        const result = await mission_control.handler(manager, {
            command: "update",
            payload: { task_id: t1.id, status: "in_progress", result_summary: "Started" }
        });

        expect(result.success).toBe(true);
        const task = result.data as any;
        expect(task.status).toBe("in_progress");
        expect(task.metadata.result_summary).toBe("Started");
    });

    it("should handle 'claim' command", async () => {
        const t1 = manager.createTask(missionId, "Task to Claim");

        const result = await mission_control.handler(manager, {
            command: "claim",
            payload: { task_id: t1.id }
        });

        expect(result.success).toBe(true);
        const task = result.data as any;
        expect(task.status).toBe("in_progress");
        expect(task.assignee).toBeDefined();
    });

    it("should handle 'query' command", async () => {
        const t1 = manager.createTask(missionId, "Ready One");
        const t2 = manager.createTask(missionId, "Blocked One");
        const t3 = manager.createTask(missionId, "Blocker");
        await manager.linkTasks(t3.id, t2.id);

        const result = await mission_control.handler(manager, {
            command: "query",
            payload: { view: "ready" }
        });

        expect(result.success).toBe(true);
        expect(result.count).toBe(2);
        const ids = (result.data as any[]).map(t => t.id);
        expect(ids).toContain(t1.id);
        expect(ids).toContain(t3.id);
        expect(ids).not.toContain(t2.id); // Blocked
    });

    it("should handle 'query: all' command", async () => {
        const t1 = manager.createTask(missionId, "T1");
        const t2 = manager.createTask(missionId, "T2");

        const result = await mission_control.handler(manager, {
            command: "query",
            payload: { view: "all" }
        });

        expect(result.success).toBe(true);
        expect(result.count).toBe(2);
    });

    it("should handle 'query: active' command", async () => {
        const t1 = manager.createTask(missionId, "Processing");
        manager.claimTask(t1.id, "agent-1"); // Set status to in_progress
        const t2 = manager.createTask(missionId, "Pending");

        const result = await mission_control.handler(manager, {
            command: "query",
            payload: { view: "active" }
        });

        expect(result.success).toBe(true);
        expect(result.count).toBe(1);
        expect((result.data as any)[0].id).toBe(t1.id);
    });

    it("should throw error for missing arguments", async () => {
        // Create without title
        const promise = mission_control.handler(manager, {
            command: "create",
            payload: { description: "No title" } as any
        });
        expect(promise).rejects.toThrow("Title is required");
    });

    it("should propagate core errors (e.g. cycles) through tool", async () => {
        const t1 = manager.createTask(missionId, "A");
        const t2 = manager.createTask(missionId, "B");
        await manager.linkTasks(t1.id, t2.id); // A -> B

        // Try B -> A via tool
        const promise = mission_control.handler(manager, {
            command: "link",
            payload: { task_id: t2.id, target_task_id: t1.id }
        });

        expect(promise).rejects.toThrow(); // CycleDetectedError
    });

    it("should accept acceptance_criteria and return rich report", async () => {
        const result = await mission_control.handler(manager, {
            command: "create",
            payload: { title: "Test AC", acceptance_criteria: "Must pass all tests" } as any
        });

        expect(result.success).toBe(true);
        expect((result.data as any).acceptance_criteria).toBe("Must pass all tests");

        const query = await mission_control.handler(manager, {
            command: "query",
            payload: { view: "all" }
        });

        // Verify Rich Report
        expect(query.message).toContain("Mission Control Report");
        expect(query.message).toContain("✅ Criteria: Must pass all tests");
        expect(query.message).toContain("🆔");
    });

    it("should handle complete task lifecycle workflow", async () => {
        // Create a feature development workflow
        const featureTask = await mission_control.handler(manager, {
            command: "create",
            payload: { title: "Implement User Authentication", priority: 1, acceptance_criteria: "Users can login/logout securely" }
        });
        expect(featureTask.success).toBe(true);
        const featureId = (featureTask.data as any).id;

        const subTask1 = await mission_control.handler(manager, {
            command: "create",
            payload: { title: "Design API endpoints", priority: 2 }
        });
        const subTask1Id = (subTask1.data as any).id;

        const subTask2 = await mission_control.handler(manager, {
            command: "create",
            payload: { title: "Implement login logic", priority: 2 }
        });
        const subTask2Id = (subTask2.data as any).id;

        const subTask3 = await mission_control.handler(manager, {
            command: "create",
            payload: { title: "Add tests", priority: 3 }
        });
        const subTask3Id = (subTask3.data as any).id;

        // Link dependencies: API design -> login logic -> tests
        await mission_control.handler(manager, {
            command: "link",
            payload: { task_id: subTask1Id, target_task_id: subTask2Id }
        });
        await mission_control.handler(manager, {
            command: "link",
            payload: { task_id: subTask2Id, target_task_id: subTask3Id }
        });

        // Check initial ready tasks (only API design and feature task)
        const readyQuery1 = await mission_control.handler(manager, {
            command: "query",
            payload: { view: "ready" }
        });
        expect(readyQuery1.count).toBe(2);
        const readyIds1 = (readyQuery1.data as any[]).map(t => t.id);
        expect(readyIds1).toContain(featureId);
        expect(readyIds1).toContain(subTask1Id);

        // Claim and complete API design
        await mission_control.handler(manager, {
            command: "claim",
            payload: { task_id: subTask1Id }
        });
        await mission_control.handler(manager, {
            command: "update",
            payload: { task_id: subTask1Id, status: "completed", result_summary: "API designed" }
        });

        // Now login logic should be ready
        const readyQuery2 = await mission_control.handler(manager, {
            command: "query",
            payload: { view: "ready" }
        });
        expect(readyQuery2.count).toBe(2);
        const readyIds2 = (readyQuery2.data as any[]).map(t => t.id);
        expect(readyIds2).toContain(featureId);
        expect(readyIds2).toContain(subTask2Id);

        // Claim and work on login logic
        await mission_control.handler(manager, {
            command: "claim",
            payload: { task_id: subTask2Id }
        });
        await mission_control.handler(manager, {
            command: "update",
            payload: { task_id: subTask2Id, status: "in_progress", result_summary: "Started implementation" }
        });

        // Check active tasks
        const activeQuery = await mission_control.handler(manager, {
            command: "query",
            payload: { view: "active" }
        });
        expect(activeQuery.count).toBe(1);
        expect((activeQuery.data as any)[0].id).toBe(subTask2Id);

        // Complete login logic
        await mission_control.handler(manager, {
            command: "update",
            payload: { task_id: subTask2Id, status: "completed", result_summary: "Login implemented" }
        });

        // Now tests should be ready
        const readyQuery3 = await mission_control.handler(manager, {
            command: "query",
            payload: { view: "ready" }
        });
        expect(readyQuery3.count).toBe(2);
        const readyIds3 = (readyQuery3.data as any[]).map(t => t.id);
        expect(readyIds3).toContain(featureId);
        expect(readyIds3).toContain(subTask3Id);

        // Complete the feature
        await mission_control.handler(manager, {
            command: "update",
            payload: { task_id: featureId, status: "completed", result_summary: "Authentication feature complete" }
        });

        // Final query should show all completed
        const allQuery = await mission_control.handler(manager, {
            command: "query",
            payload: { view: "all" }
        });
        expect(allQuery.count).toBe(4);
        const allTasks = allQuery.data as any[];
        const completedCount = allTasks.filter(t => t.status === "completed").length;
        expect(completedCount).toBe(3); // 3 subtasks + feature
    });

    it("should handle workflow with error recovery", async () => {
        // Create task that will fail
        const failingTask = await mission_control.handler(manager, {
            command: "create",
            payload: { title: "Failing Task", priority: 1 }
        });
        const failingId = (failingTask.data as any).id;

        // Claim and mark as failed
        await mission_control.handler(manager, {
            command: "claim",
            payload: { task_id: failingId }
        });
        await mission_control.handler(manager, {
            command: "update",
            payload: { task_id: failingId, status: "failed", result_summary: "Failed due to bug" }
        });

        // Create recovery task
        const recoveryTask = await mission_control.handler(manager, {
            command: "create",
            payload: { title: "Fix the bug", priority: 0 }
        });
        const recoveryId = (recoveryTask.data as any).id;

        // Link recovery to failing task (but since failing is failed, recovery can proceed)
        // Actually, dependencies are for blocking, but for recovery, perhaps create new task

        // Query should show recovery as ready
        const readyQuery = await mission_control.handler(manager, {
            command: "query",
            payload: { view: "ready" }
        });
        expect(readyQuery.count).toBe(1);
        expect((readyQuery.data as any)[0].id).toBe(recoveryId);

        // Complete recovery
        await mission_control.handler(manager, {
            command: "claim",
            payload: { task_id: recoveryId }
        });
        await mission_control.handler(manager, {
            command: "update",
            payload: { task_id: recoveryId, status: "completed", result_summary: "Bug fixed" }
        });

        // Verify final state
        const allQuery = await mission_control.handler(manager, {
            command: "query",
            payload: { view: "all" }
        });
        expect(allQuery.count).toBe(2);
    });
});
