import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { MissionStore } from "../../src/persistence/MissionStore";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";

describe("Feature: Mission Persistence", () => {
    // Use a unique temp database for each test run to ensure isolation
    const TEST_DB_PATH = join(import.meta.dir, `../../temp_test_mission_bdd_${Math.random().toString(36).slice(2)}.sqlite`);

    let store: MissionStore;

    beforeEach(() => {
        // cleanup not really needed if we use random paths but good practice if random collision (improbable)
        store = new MissionStore(TEST_DB_PATH);
    });

    afterEach(() => {
        try {
            if (store) store.close();
        } catch (e) { }

        // Wait a small tick? No, synchronous unlink should work if closed.
        // Try deleting main, wal, shm
        [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach(p => {
            if (existsSync(p)) {
                try {
                    unlinkSync(p);
                } catch (e) { }
            }
        });
    });

    describe("Scenario: Creating and retrieving missions", () => {
        it("should successfully store and retrieve a new mission", () => {
            // Given a new mission data
            const missionId = "test-mission";
            const missionData = {
                id: missionId,
                title: "Test Mission",
                status: "active" as const,
                created_at: new Date().toISOString()
            };

            // When creating the mission
            store.createMission(missionData);

            // Then it should be retrievable by ID
            const retrieved = store.getMission(missionId);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.title).toBe("Test Mission");
        });
    });

    describe("Scenario: Task Management", () => {
        it("should create and retrieve a task with full details", () => {
            // Given a mission exists
            const missionId = "mission-1";
            store.createMission({
                id: missionId,
                title: "Mission 1",
                status: "active",
                created_at: new Date().toISOString()
            });

            // When a task is created linked to that mission
            const taskId = "task-1";
            const now = new Date().toISOString();
            store.createTask({
                id: taskId,
                mission_id: missionId,
                title: "Task 1",
                description: "Desc",
                status: "pending",
                priority: 4,
                assignee: null,
                created_at: now,
                updated_at: now,
                metadata: { key: "value" }
            });

            // Then the task should be retrievable with correct metadata
            const retrieved = store.getTask(taskId);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.title).toBe("Task 1");
            expect(retrieved?.metadata).toEqual({ key: "value" });
        });

        it("should update a task's status and assignee", () => {
            // Given a task is created
            const missionId = "mission-status";
            store.createMission({ id: missionId, title: "M", status: "active", created_at: "" });
            store.createTask({
                id: "t-1",
                mission_id: missionId,
                title: "T",
                description: "",
                status: "pending",
                priority: 4,
                assignee: null,
                created_at: "",
                updated_at: "",
                metadata: {}
            });

            // When updating status to 'in_progress' with an assignee
            store.updateTaskStatus("t-1", "in_progress", "agent-1");

            // Then the changes should be reflected
            const t = store.getTask("t-1");
            expect(t?.status).toBe("in_progress");
            expect(t?.assignee).toBe("agent-1");
        });
    });

    describe("Scenario: Task Dependencies", () => {
        it("should correctly link blocker and blocked tasks", () => {
            // Given two tasks T1 and T2
            const mid = "m-deps";
            store.createMission({ id: mid, title: "M", status: "active", created_at: "" });
            store.createTask({ id: "t-1", mission_id: mid, title: "Blocker", description: "", status: "pending", priority: 4, assignee: null, created_at: "", updated_at: "", metadata: {} });
            store.createTask({ id: "t-2", mission_id: mid, title: "Blocked", description: "", status: "pending", priority: 4, assignee: null, created_at: "", updated_at: "", metadata: {} });

            // When T1 is set as a dependency for T2 (T1 blocks T2)
            store.addDependency({ blocker_id: "t-1", blocked_id: "t-2", mission_id: mid });

            // Then T2 should list T1 as a blocker
            const blockers = store.getDependencies("t-2");
            expect(blockers).toContain("t-1");

            // And T1 should list T2 as a dependent
            const dependents = store.getDependents("t-1");
            expect(dependents).toContain("t-2");
        });
    });

    describe("Scenario: Querying Ready Tasks", () => {
        it("should identify tasks as ready only when all dependencies are completed", () => {
            // Given a mission with a chain of tasks: T3 -> T2 -> T5 (completed) -> T4
            const mid = "m-ready";
            store.createMission({ id: mid, title: "M", status: "active", created_at: "" });

            // T1: Independent -> READY
            store.createTask({ id: "t-1", mission_id: mid, title: "Ready Task", description: "", status: "pending", priority: 4, assignee: null, created_at: "2023-01-01", updated_at: "", metadata: {} });

            // T2: Blocked by T3 -> NOT READY
            store.createTask({ id: "t-2", mission_id: mid, title: "Blocked Task", description: "", status: "pending", priority: 4, assignee: null, created_at: "2023-01-02", updated_at: "", metadata: {} });

            // T3: Pending, blocks T2
            store.createTask({ id: "t-3", mission_id: mid, title: "Blocker Task", description: "", status: "pending", priority: 4, assignee: null, created_at: "2023-01-03", updated_at: "", metadata: {} });
            store.addDependency({ blocker_id: "t-3", blocked_id: "t-2", mission_id: mid });

            // T4: Blocked by T5 which is Completed -> READY
            store.createTask({ id: "t-4", mission_id: mid, title: "Unblocked Task", description: "", status: "pending", priority: 4, assignee: null, created_at: "2023-01-04", updated_at: "", metadata: {} });
            store.createTask({ id: "t-5", mission_id: mid, title: "Completed Blocker", description: "", status: "completed", priority: 4, assignee: null, created_at: "2023-01-05", updated_at: "", metadata: {} });
            store.addDependency({ blocker_id: "t-5", blocked_id: "t-4", mission_id: mid });

            // When querying for ready tasks
            const readyTasks = store.getReadyTasks(mid);
            const readyIds = readyTasks.map(t => t.id);

            // Then independent task T1 should be ready
            expect(readyIds).toContain("t-1");
            // And unblocked task T4 should be ready
            expect(readyIds).toContain("t-4");
            // And blocker T3 should be ready (it has no dependencies itself)
            expect(readyIds).toContain("t-3");
            // But blocked task T2 should NOT be ready (T3 is pending)
            expect(readyIds).not.toContain("t-2");
        });
    });

    describe("Scenario: Query Methods", () => {
        it("should retrieve all tasks for a mission", () => {
            // Given a mission with multiple tasks
            const missionId = "mission-query";
            store.createMission({ id: missionId, title: "Query Mission", status: "active", created_at: new Date().toISOString() });

            store.createTask({
                id: "task-1",
                mission_id: missionId,
                title: "Task 1",
                description: "First task",
                status: "pending",
                priority: 1,
                assignee: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: { order: 1 }
            });

            store.createTask({
                id: "task-2",
                mission_id: missionId,
                title: "Task 2",
                description: "Second task",
                status: "completed",
                priority: 2,
                assignee: "agent-1",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: { order: 2 }
            });

            // When retrieving all tasks for the mission
            const tasks = store.getTasksByMission(missionId);

            // Then it should return all tasks with correct data
            expect(tasks).toHaveLength(2);
            const taskIds = tasks.map(t => t.id).sort();
            expect(taskIds).toEqual(["task-1", "task-2"]);

            const task1 = tasks.find(t => t.id === "task-1");
            expect(task1?.title).toBe("Task 1");
            expect(task1?.metadata).toEqual({ order: 1 });

            const task2 = tasks.find(t => t.id === "task-2");
            expect(task2?.status).toBe("completed");
            expect(task2?.metadata).toEqual({ order: 2 });
        });

        it("should return empty array for mission with no tasks", () => {
            // Given a mission with no tasks
            const missionId = "empty-mission";
            store.createMission({ id: missionId, title: "Empty Mission", status: "active", created_at: new Date().toISOString() });

            // When retrieving tasks
            const tasks = store.getTasksByMission(missionId);

            // Then it should return empty array
            expect(tasks).toEqual([]);
        });

        it("should retrieve dependents of a task", () => {
            // Given tasks with dependencies
            const missionId = "deps-mission";
            store.createMission({ id: missionId, title: "Deps Mission", status: "active", created_at: new Date().toISOString() });

            store.createTask({ id: "blocker", mission_id: missionId, title: "Blocker", description: "", status: "pending", priority: 2, assignee: null, created_at: "", updated_at: "", metadata: {} });
            store.createTask({ id: "dependent1", mission_id: missionId, title: "Dep1", description: "", status: "pending", priority: 2, assignee: null, created_at: "", updated_at: "", metadata: {} });
            store.createTask({ id: "dependent2", mission_id: missionId, title: "Dep2", description: "", status: "pending", priority: 2, assignee: null, created_at: "", updated_at: "", metadata: {} });

            store.addDependency({ blocker_id: "blocker", blocked_id: "dependent1", mission_id: missionId });
            store.addDependency({ blocker_id: "blocker", blocked_id: "dependent2", mission_id: missionId });

            // When getting dependents of the blocker
            const dependents = store.getDependents("blocker");

            // Then it should return the dependent task IDs
            expect(dependents).toHaveLength(2);
            expect(dependents).toContain("dependent1");
            expect(dependents).toContain("dependent2");
        });

        it("should retrieve dependencies of a task", () => {
            // Given tasks with dependencies
            const missionId = "deps2-mission";
            store.createMission({ id: missionId, title: "Deps2 Mission", status: "active", created_at: new Date().toISOString() });

            store.createTask({ id: "blocked", mission_id: missionId, title: "Blocked", description: "", status: "pending", priority: 2, assignee: null, created_at: "", updated_at: "", metadata: {} });
            store.createTask({ id: "dep1", mission_id: missionId, title: "Dep1", description: "", status: "pending", priority: 2, assignee: null, created_at: "", updated_at: "", metadata: {} });
            store.createTask({ id: "dep2", mission_id: missionId, title: "Dep2", description: "", status: "pending", priority: 2, assignee: null, created_at: "", updated_at: "", metadata: {} });

            store.addDependency({ blocker_id: "dep1", blocked_id: "blocked", mission_id: missionId });
            store.addDependency({ blocker_id: "dep2", blocked_id: "blocked", mission_id: missionId });

            // When getting dependencies of the blocked task
            const dependencies = store.getDependencies("blocked");

            // Then it should return the blocker task IDs
            expect(dependencies).toHaveLength(2);
            expect(dependencies).toContain("dep1");
            expect(dependencies).toContain("dep2");
        });
    });

    describe("Scenario: Error Handling", () => {
        it("should throw on invalid JSON in task metadata during getTask", () => {
            // Given a task with corrupted metadata JSON
            const missionId = "mission-error";
            store.createMission({ id: missionId, title: "Error Mission", status: "active", created_at: new Date().toISOString() });

            // Insert directly with invalid JSON
            (store as any).db.exec(`INSERT INTO tasks (id, mission_id, title, description, status, priority, assignee, created_at, updated_at, metadata)
                VALUES ('corrupt-task', '${missionId}', 'Corrupt Task', 'Desc', 'pending', 2, NULL, '${new Date().toISOString()}', '${new Date().toISOString()}', '{invalid json}')`);

            // When retrieving the task
            // Then it should throw due to JSON.parse error
            expect(() => store.getTask('corrupt-task')).toThrow();
        });

        it("should throw on invalid JSON in metadata during getTasksByMission", () => {
            // Given a mission with a task having corrupted metadata
            const missionId = "mission-corrupt";
            store.createMission({ id: missionId, title: "Corrupt Mission", status: "active", created_at: new Date().toISOString() });

            store.createTask({
                id: "good-task",
                mission_id: missionId,
                title: "Good Task",
                description: "Desc",
                status: "pending",
                priority: 2,
                assignee: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: { valid: true }
            });

            // Insert another task with invalid JSON
            (store as any).db.exec(`INSERT INTO tasks (id, mission_id, title, description, status, priority, assignee, created_at, updated_at, metadata)
                VALUES ('bad-task', '${missionId}', 'Bad Task', 'Desc', 'pending', 2, NULL, '${new Date().toISOString()}', '${new Date().toISOString()}', '[not json')`);

            // When retrieving all tasks for the mission
            // Then it should throw due to JSON.parse error on the corrupted task
            expect(() => store.getTasksByMission(missionId)).toThrow();
        });

        it("should throw on invalid JSON in metadata during getReadyTasks", () => {
            // Given a mission with a ready task having corrupted metadata
            const missionId = "mission-ready-corrupt";
            store.createMission({ id: missionId, title: "Ready Corrupt Mission", status: "active", created_at: new Date().toISOString() });

            // Insert a pending task with invalid JSON
            (store as any).db.exec(`INSERT INTO tasks (id, mission_id, title, description, status, priority, assignee, created_at, updated_at, metadata)
                VALUES ('ready-corrupt', '${missionId}', 'Ready Corrupt', 'Desc', 'pending', 2, NULL, '${new Date().toISOString()}', '${new Date().toISOString()}', 'null invalid')`);

            // When querying for ready tasks
            // Then it should throw due to JSON.parse error
            expect(() => store.getReadyTasks(missionId)).toThrow();
        });

        it("should propagate errors from transaction callback", () => {
            // When running a transaction with a callback that throws
            // Then the error should be propagated
            expect(() => store.runTransaction(() => {
                throw new Error("Transaction failed");
            })).toThrow("Transaction failed");
        });

        it("should handle empty results for getDependents", () => {
            // Given a task with no dependents
            const missionId = "mission-deps";
            store.createMission({ id: missionId, title: "Deps Mission", status: "active", created_at: new Date().toISOString() });
            store.createTask({
                id: "independent-task",
                mission_id: missionId,
                title: "Independent",
                description: "",
                status: "pending",
                priority: 2,
                assignee: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: {}
            });

            // When getting dependents
            const dependents = store.getDependents("independent-task");

            // Then it should return empty array
            expect(dependents).toEqual([]);
        });

        it("should handle empty results for getDependencies", () => {
            // Given a task with no dependencies
            const missionId = "mission-deps2";
            store.createMission({ id: missionId, title: "Deps2 Mission", status: "active", created_at: new Date().toISOString() });
            store.createTask({
                id: "no-deps-task",
                mission_id: missionId,
                title: "No Deps",
                description: "",
                status: "pending",
                priority: 2,
                assignee: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: {}
            });

            // When getting dependencies
            const dependencies = store.getDependencies("no-deps-task");

            // Then it should return empty array
            expect(dependencies).toEqual([]);
        });
    });
});
