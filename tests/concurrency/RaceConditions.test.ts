import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { MissionStore } from "../../src/persistence/MissionStore";
import { MissionManager } from "../../src/core/MissionManager";
import { mission_control } from "../../src/tools/implementations/mission_control";
import { getContextMissionId } from "../../src/utils/context";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { TaskLockedError } from "../../src/types/errors";

describe("Concurrency & Isolation", () => {
    const TEST_DB_PATH = join(import.meta.dir, `../../temp_test_race_bdd_${Math.random().toString(36).slice(2)}.sqlite`);
    let store: MissionStore;
    let manager: MissionManager;
    let missionId: string;

    beforeEach(() => {
        store = new MissionStore(TEST_DB_PATH);
        manager = new MissionManager(store);
        missionId = getContextMissionId();
        manager.createMission(missionId, "Race Context");
    });

    afterEach(() => {
        try { if (store) store.close(); } catch (e) { }
        [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach(p => {
            if (existsSync(p)) { try { unlinkSync(p); } catch (e) { } }
        });
    });

    it("should handle race condition: Multiple agents claiming same task", async () => {
        
        const t1 = manager.createTask(missionId, "High Value Task");

        
        const agents = ["agent-1", "agent-2", "agent-3", "agent-4", "agent-5"];

        
        
        const results = await Promise.allSettled(agents.map(agentId => {
            
            
            return new Promise((resolve, reject) => {
                try {
                    const task = manager.claimTask(t1.id, agentId);
                    resolve({ agentId, task });
                } catch (e) {
                    reject(e);
                }
            });
        }));

        
        const success = results.filter(r => r.status === "fulfilled");
        const failed = results.filter(r => r.status === "rejected");

        expect(success.length).toBe(1);
        expect(failed.length).toBe(4);

        
        failed.forEach((r: any) => {
            expect(r.reason).toBeInstanceOf(TaskLockedError);
        });

        
        const winner = (success[0] as any).value;
        const finalTask = store.getTask(t1.id);
        expect(finalTask?.assignee).toBe(winner.agentId);
        expect(finalTask?.status).toBe('in_progress');
    });

    it("should prevent cross-mission interference during parallel execution", async () => {
        
        const m1 = "mission-A";
        const m2 = "mission-B";
        manager.createMission(m1, "Mission A");
        manager.createMission(m2, "Mission B");

        
        const tasksA = 50;
        const tasksB = 50;

        const pA = Promise.all(Array.from({ length: tasksA }).map((_, i) =>
            new Promise<void>(resolve => {
                manager.createTask(m1, `A-${i}`);
                resolve();
            })
        ));

        const pB = Promise.all(Array.from({ length: tasksB }).map((_, i) =>
            new Promise<void>(resolve => {
                manager.createTask(m2, `B-${i}`);
                resolve();
            })
        ));

        await Promise.all([pA, pB]);

        
        const resultA = store.getTasksByMission(m1);
        const resultB = store.getTasksByMission(m2);

        expect(resultA.length).toBe(tasksA);
        expect(resultB.length).toBe(tasksB);

        
        resultA.forEach(t => expect(t.mission_id).toBe(m1));
        resultB.forEach(t => expect(t.mission_id).toBe(m2));
    });
});
