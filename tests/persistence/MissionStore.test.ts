import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { MissionStore } from "../../src/persistence/MissionStore";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";

describe("Feature: Mission Persistence", () => {
    let store: MissionStore;
    let tempDbPath: string;

    beforeEach(() => {
        tempDbPath = `.test-db-${Date.now()}-${Math.random()}.sqlite`;
        store = new MissionStore(tempDbPath);
    });

    afterEach(() => {
        try {
            store.close();
        } catch (e) {}
        [tempDbPath, `${tempDbPath}-wal`, `${tempDbPath}-shm`].forEach(p => {
            if (existsSync(p)) {
                try {
                    unlinkSync(p);
                } catch (e) { }
            }
        });
    });

    describe("Scenario: Creating and retrieving missions", () => {
        it("should successfully store and retrieve a new mission", () => {
            const missionId = "test-mission";
            const missionData = {
                id: missionId,
                title: "Test Mission",
                status: "active" as const,
                created_at: new Date().toISOString()
            };

            store.createMission(missionData);
            const retrieved = store.getMission(missionId);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.title).toBe("Test Mission");
        });
    });

    describe("Scenario: Task Management", () => {
        it("should create and retrieve a task with full details", () => {
            
            const missionId = "mission-1";
            store.createMission({
                id: missionId,
                title: "Mission 1",
                status: "active",
                created_at: new Date().toISOString()
            });

            
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

            
            const retrieved = store.getTask(taskId);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.title).toBe("Task 1");
            expect(retrieved?.metadata).toEqual({ key: "value" });
        });

        it("should update a task's status and assignee", () => {
            
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

            
            store.updateTaskStatus("t-1", "in_progress", "agent-1");

            
            const t = store.getTask("t-1");
            expect(t?.status).toBe("in_progress");
            expect(t?.assignee).toBe("agent-1");
        });
    });

    describe("Scenario: Task Dependencies", () => {
        it("should correctly link blocker and blocked tasks", () => {
            
            const mid = "m-deps";
            store.createMission({ id: mid, title: "M", status: "active", created_at: "" });
            store.createTask({ id: "t-1", mission_id: mid, title: "Blocker", description: "", status: "pending", priority: 4, assignee: null, created_at: "", updated_at: "", metadata: {} });
            store.createTask({ id: "t-2", mission_id: mid, title: "Blocked", description: "", status: "pending", priority: 4, assignee: null, created_at: "", updated_at: "", metadata: {} });

            
            store.addDependency({ blocker_id: "t-1", blocked_id: "t-2", mission_id: mid });

            
            const blockers = store.getDependencies("t-2");
            expect(blockers).toContain("t-1");

            
            const dependents = store.getDependents("t-1");
            expect(dependents).toContain("t-2");
        });
    });

    describe("Scenario: Querying Ready Tasks", () => {
        it("should identify tasks as ready only when all dependencies are completed", () => {
            
            const mid = "m-ready";
            store.createMission({ id: mid, title: "M", status: "active", created_at: "" });

            
            store.createTask({ id: "t-1", mission_id: mid, title: "Ready Task", description: "", status: "pending", priority: 4, assignee: null, created_at: "2023-01-01", updated_at: "", metadata: {} });

            
            store.createTask({ id: "t-2", mission_id: mid, title: "Blocked Task", description: "", status: "pending", priority: 4, assignee: null, created_at: "2023-01-02", updated_at: "", metadata: {} });

            
            store.createTask({ id: "t-3", mission_id: mid, title: "Blocker Task", description: "", status: "pending", priority: 4, assignee: null, created_at: "2023-01-03", updated_at: "", metadata: {} });
            store.addDependency({ blocker_id: "t-3", blocked_id: "t-2", mission_id: mid });

            
            store.createTask({ id: "t-4", mission_id: mid, title: "Unblocked Task", description: "", status: "pending", priority: 4, assignee: null, created_at: "2023-01-04", updated_at: "", metadata: {} });
            store.createTask({ id: "t-5", mission_id: mid, title: "Completed Blocker", description: "", status: "completed", priority: 4, assignee: null, created_at: "2023-01-05", updated_at: "", metadata: {} });
            store.addDependency({ blocker_id: "t-5", blocked_id: "t-4", mission_id: mid });

            
            const readyTasks = store.getReadyTasks(mid);
            const readyIds = readyTasks.map(t => t.id);

            
            expect(readyIds).toContain("t-1");
            
            expect(readyIds).toContain("t-4");
            
            expect(readyIds).toContain("t-3");
            
            expect(readyIds).not.toContain("t-2");
        });
    });

    describe("Scenario: Query Methods", () => {
        it("should retrieve all tasks for a mission", () => {
            
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

            
            const tasks = store.getTasksByMission(missionId);

            
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
            
            const missionId = "empty-mission";
            store.createMission({ id: missionId, title: "Empty Mission", status: "active", created_at: new Date().toISOString() });

            
            const tasks = store.getTasksByMission(missionId);

            
            expect(tasks).toEqual([]);
        });

        it("should retrieve dependents of a task", () => {
            
            const missionId = "deps-mission";
            store.createMission({ id: missionId, title: "Deps Mission", status: "active", created_at: new Date().toISOString() });

            store.createTask({ id: "blocker", mission_id: missionId, title: "Blocker", description: "", status: "pending", priority: 2, assignee: null, created_at: "", updated_at: "", metadata: {} });
            store.createTask({ id: "dependent1", mission_id: missionId, title: "Dep1", description: "", status: "pending", priority: 2, assignee: null, created_at: "", updated_at: "", metadata: {} });
            store.createTask({ id: "dependent2", mission_id: missionId, title: "Dep2", description: "", status: "pending", priority: 2, assignee: null, created_at: "", updated_at: "", metadata: {} });

            store.addDependency({ blocker_id: "blocker", blocked_id: "dependent1", mission_id: missionId });
            store.addDependency({ blocker_id: "blocker", blocked_id: "dependent2", mission_id: missionId });

            
            const dependents = store.getDependents("blocker");

            
            expect(dependents).toHaveLength(2);
            expect(dependents).toContain("dependent1");
            expect(dependents).toContain("dependent2");
        });

        it("should retrieve dependencies of a task", () => {
            
            const missionId = "deps2-mission";
            store.createMission({ id: missionId, title: "Deps2 Mission", status: "active", created_at: new Date().toISOString() });

            store.createTask({ id: "blocked", mission_id: missionId, title: "Blocked", description: "", status: "pending", priority: 2, assignee: null, created_at: "", updated_at: "", metadata: {} });
            store.createTask({ id: "dep1", mission_id: missionId, title: "Dep1", description: "", status: "pending", priority: 2, assignee: null, created_at: "", updated_at: "", metadata: {} });
            store.createTask({ id: "dep2", mission_id: missionId, title: "Dep2", description: "", status: "pending", priority: 2, assignee: null, created_at: "", updated_at: "", metadata: {} });

            store.addDependency({ blocker_id: "dep1", blocked_id: "blocked", mission_id: missionId });
            store.addDependency({ blocker_id: "dep2", blocked_id: "blocked", mission_id: missionId });

            
            const dependencies = store.getDependencies("blocked");

            
            expect(dependencies).toHaveLength(2);
            expect(dependencies).toContain("dep1");
            expect(dependencies).toContain("dep2");
        });
    });

    describe("Scenario: Error Handling", () => {
        it("should return empty metadata on invalid JSON in task metadata during getTask", () => {
            
            const missionId = "mission-error";
            store.createMission({ id: missionId, title: "Error Mission", status: "active", created_at: new Date().toISOString() });

            
            (store as any).db.exec(`INSERT INTO tasks (id, mission_id, title, description, status, priority, assignee, created_at, updated_at, metadata)
                VALUES ('corrupt-task', '${missionId}', 'Corrupt Task', 'Desc', 'pending', 2, NULL, '${new Date().toISOString()}', '${new Date().toISOString()}', '{invalid json}')`);

            
            const task = store.getTask('corrupt-task');

            
            expect(task).toBeDefined();
            expect(task!.metadata).toEqual({});
        });

        it("should return empty metadata for corrupted tasks during getTasksByMission", () => {
            
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
                acceptance_criteria: null,
                metadata: { valid: true }
            });

            
            (store as any).db.exec(`INSERT INTO tasks (id, mission_id, title, description, status, priority, assignee, created_at, updated_at, metadata)
                VALUES ('bad-task', '${missionId}', 'Bad Task', 'Desc', 'pending', 2, NULL, '${new Date().toISOString()}', '${new Date().toISOString()}', '[not json')`);

            
            const tasks = store.getTasksByMission(missionId);

            
            expect(tasks).toHaveLength(2);
            const badTask = tasks.find(t => t.id === 'bad-task');
            expect(badTask!.metadata).toEqual({});
            const goodTask = tasks.find(t => t.id === 'good-task');
            expect(goodTask!.metadata).toEqual({ valid: true });
        });

        it("should return empty metadata for corrupted tasks during getReadyTasks", () => {
            
            const missionId = "mission-ready-corrupt";
            store.createMission({ id: missionId, title: "Ready Corrupt Mission", status: "active", created_at: new Date().toISOString() });

            
            (store as any).db.exec(`INSERT INTO tasks (id, mission_id, title, description, status, priority, assignee, created_at, updated_at, metadata)
                VALUES ('ready-corrupt', '${missionId}', 'Ready Corrupt', 'Desc', 'pending', 2, NULL, '${new Date().toISOString()}', '${new Date().toISOString()}', 'null invalid')`);

            
            const tasks = store.getReadyTasks(missionId);

            
            expect(tasks).toHaveLength(1);
            expect(tasks[0].metadata).toEqual({});
        });

        it("should propagate errors from transaction callback", () => {
            
            
            expect(() => store.runTransaction(() => {
                throw new Error("Transaction failed");
            })).toThrow("Transaction failed");
        });

        it("should handle empty results for getDependents", () => {
            
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

            
            const dependents = store.getDependents("independent-task");

            
            expect(dependents).toEqual([]);
        });

        it("should handle empty results for getDependencies", () => {
            
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

            
            const dependencies = store.getDependencies("no-deps-task");

            
            expect(dependencies).toEqual([]);
        });
    });
});
