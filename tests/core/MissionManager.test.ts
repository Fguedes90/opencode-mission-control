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
            // Given valid ID and title
            const mission = manager.createMission("proj-1", "Project 1");

            // Then the mission is persisted
            expect(mission.id).toBe("proj-1");
            expect(store.getMission("proj-1")).not.toBeNull();
        });

        it("should prevent duplicate mission IDs", () => {
            // Given existing mission
            manager.createMission("proj-1", "Project 1");

            // When trying to create again with same ID
            // Then it should throw InvalidOperationError
            expect(() => {
                manager.createMission("proj-1", "Duplicate");
            }).toThrow(InvalidOperationError);
        });
    });

    describe("Scenario: Linking Tasks (High Level)", () => {
        it("should prevent linking tasks across different missions", async () => {
            // Given two missions and tasks in each
            manager.createMission("m1", "M1");
            manager.createMission("m2", "M2");
            const t1 = manager.createTask("m1", "T1");
            const t2 = manager.createTask("m2", "T2");

            // When trying to link T1 -> T2
            // Then it should throw violation error
            await expect(manager.linkTasks(t1.id, t2.id)).rejects.toThrow(InvalidOperationError);
        });

        it("should validate and prevent cycles via GraphEngine", async () => {
            // Given tasks A and B in same mission
            manager.createMission("m1", "M1");
            const tA = manager.createTask("m1", "A");
            const tB = manager.createTask("m1", "B");

            // And A depends on B (B blocks A) -> B -> A
            await manager.linkTasks(tB.id, tA.id);

            // When trying to make B depend on A (A -> B)
            // Then it should throw CycleDetectedError
            await expect(manager.linkTasks(tA.id, tB.id)).rejects.toThrow(CycleDetectedError);
        });
    });

    describe("Scenario: Task Claiming", () => {
        it("should allow claiming a task if it is ready and unclaimed", () => {
            // Given a ready task (no blockers)
            manager.createMission("m1", "M1");
            const t1 = manager.createTask("m1", "T1");

            // When agent claims it
            const claimed = manager.claimTask(t1.id, "agent-007");

            // Then status changes to 'in_progress' and assignee is set
            expect(claimed.status).toBe("in_progress");
            expect(claimed.assignee).toBe("agent-007");
        });

        it("should prevent claiming if task is locked by another agent", () => {
            // Given task is claimed by agent A
            manager.createMission("m1", "M1");
            const t1 = manager.createTask("m1", "T1");
            manager.claimTask(t1.id, "agent-A");

            // When agent B tries to claim
            // Then it should throw TaskLockedError
            expect(() => {
                manager.claimTask(t1.id, "agent-B");
            }).toThrow(TaskLockedError);
        });

        it("should prevent claiming if task is blocked by incomplete dependencies", async () => {
            // Given T1 -> T2 (T1 blocks T2)
            manager.createMission("m1", "M1");
            const t1 = manager.createTask("m1", "Blocker");
            const t2 = manager.createTask("m1", "Blocked");
            await manager.linkTasks(t1.id, t2.id);

            // When trying to claim T2
            // Then it should throw InvalidOperationError (blocked)
            expect(() => {
                manager.claimTask(t2.id, "agent-X");
            }).toThrow(InvalidOperationError);
        });
    });
});
