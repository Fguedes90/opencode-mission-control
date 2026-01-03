import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { MissionManager } from "../../src/core/MissionManager";
import { MissionStore } from "../../src/persistence/MissionStore";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { CycleDetectedError, InvalidOperationError, TaskLockedError, TaskNotFoundError } from "../../src/types/errors";

describe("Feature: Mission Logic Management", () => {
    const TEST_DB_PATH = join(import.meta.dir, `../../temp_test_manager_bdd_${Math.random().toString(36).slice(2)}.sqlite`);
    let store: MissionStore;
    let manager: MissionManager;

    beforeEach(() => {
        store = new MissionStore(TEST_DB_PATH);
        manager = new MissionManager(store);
    });

    afterEach(() => {
        try {
            if (store) store.close();
        } catch (e) { }

        [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach(p => {
            if (existsSync(p)) {
                try {
                    unlinkSync(p);
                } catch (e) { }
            }
        });
    });

    describe("Scenario: Creating Missions", () => {
        it("should create a new mission successfully", () => {
            
            const mission = manager.createMission("proj-1", "Project 1");

            
            expect(mission.id).toBe("proj-1");
            expect(store.getMission("proj-1")).not.toBeNull();
        });

        it("should prevent duplicate mission IDs", () => {
            
            manager.createMission("proj-1", "Project 1");

            
            
            expect(() => {
                manager.createMission("proj-1", "Duplicate");
            }).toThrow(InvalidOperationError);
        });
    });

    describe("Scenario: Linking Tasks (High Level)", () => {
        it("should prevent linking tasks across different missions", () => {
            
            manager.createMission("m1", "M1");
            manager.createMission("m2", "M2");
            const t1 = manager.createTask("m1", "T1");
            const t2 = manager.createTask("m2", "T2");

            
            
            expect(() => manager.linkTasks(t1.id, t2.id)).toThrow(InvalidOperationError);
        });

        it("should validate and prevent cycles", async () => {
            
            manager.createMission("m1", "M1");
            const tA = manager.createTask("m1", "A");
            const tB = manager.createTask("m1", "B");

            
            manager.linkTasks(tB.id, tA.id);

            
            
            expect(() => manager.linkTasks(tA.id, tB.id)).toThrow(CycleDetectedError);
        });
    });

    describe("Scenario: Task Claiming", () => {
        it("should allow claiming a task if it is ready and unclaimed", () => {
            
            manager.createMission("m1", "M1");
            const t1 = manager.createTask("m1", "T1");

            
            const claimed = manager.claimTask(t1.id, "agent-007");

            
            expect(claimed.status).toBe("in_progress");
            expect(claimed.assignee).toBe("agent-007");
        });

        it("should prevent claiming if task is locked by another agent", () => {
            
            manager.createMission("m1", "M1");
            const t1 = manager.createTask("m1", "T1");
            manager.claimTask(t1.id, "agent-A");

            
            
            expect(() => {
                manager.claimTask(t1.id, "agent-B");
            }).toThrow(TaskLockedError);
        });

        it("should prevent claiming if task is blocked by incomplete dependencies", async () => {
            
            manager.createMission("m1", "M1");
            const t1 = manager.createTask("m1", "Blocker");
            const t2 = manager.createTask("m1", "Blocked");
            await manager.linkTasks(t1.id, t2.id);

            
            
            expect(() => {
                manager.claimTask(t2.id, "agent-X");
            }).toThrow(InvalidOperationError);
        });
    });
});
