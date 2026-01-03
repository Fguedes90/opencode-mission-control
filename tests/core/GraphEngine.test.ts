import { describe, it, expect, mock } from "bun:test";
import { GraphEngine } from "../../src/core/GraphEngine";
import { CycleDetectedError } from "../../src/types/errors";

describe("Feature: Graph Cycle Detection", () => {
    const engine = new GraphEngine();

    describe("Scenario: Linking tasks without circular dependencies", () => {
        it("should allow linking a new task B to C given A->B exists", async () => {
            // Given A -> B
            // When linking B -> C
            const mockDeps = mock((id) => {
                if (id === "B") return ["A"]; // A blocks B
                return [];
            });

            // Then it should resolve without error
            await engine.validateNoCycle(mockDeps, "B", "C");
            expect(true).toBe(true); // Reached here means no throw
        });
    });

    describe("Scenario: Linking tasks creating an immediate cycle", () => {
        it("should throw CycleDetectedError when linking B -> A given A -> B", async () => {
            // Given A -> B
            const mockDeps = mock((id) => {
                if (id === "B") return ["A"];
                return [];
            });

            // When linking B -> A
            // Then it should throw CycleDetectedError
            let error;
            try {
                await engine.validateNoCycle(mockDeps, "B", "A");
            } catch (e) {
                error = e;
            }
            expect(error).toBeInstanceOf(CycleDetectedError);
        });
    });

    describe("Scenario: Linking tasks creating a transitive cycle", () => {
        it("should throw CycleDetectedError when linking D -> A given A -> B -> C -> D", async () => {
            // Given A -> B -> C -> D
            const mockDeps = mock((id) => {
                if (id === "D") return ["C"];
                if (id === "C") return ["B"];
                if (id === "B") return ["A"];
                return [];
            });

            // When linking D -> A (D blocks A)
            // Then it should throw CycleDetectedError
            let error;
            try {
                await engine.validateNoCycle(mockDeps, "D", "A");
            } catch (e) {
                error = e;
            }
            expect(error).toBeInstanceOf(CycleDetectedError);
        });
    });

    describe("Scenario: Self-referencing task", () => {
        it("should throw CycleDetectedError when linking A -> A", async () => {
            const mockDeps = mock(() => []);

            let error;
            try {
                await engine.validateNoCycle(mockDeps, "A", "A");
            } catch (e) {
                error = e;
            }
            expect(error).toBeInstanceOf(CycleDetectedError);
        });
    });
});
