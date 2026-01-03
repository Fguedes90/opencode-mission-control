import { describe, it, expect } from "bun:test";
import {
    MissionControlError,
    CycleDetectedError,
    TaskLockedError,
    TaskNotFoundError,
    MissionNotFoundError,
    InvalidOperationError
} from "../../src/types/errors";

describe("MissionControlError", () => {
    it("should be an instance of Error", () => {
        const error = new MissionControlError("Test message");
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(MissionControlError);
    });

    it("should have correct name and message", () => {
        const error = new MissionControlError("Custom message");
        expect(error.name).toBe("MissionControlError");
        expect(error.message).toBe("Custom message");
    });
});

describe("CycleDetectedError", () => {
    it("should extend MissionControlError", () => {
        const error = new CycleDetectedError();
        expect(error).toBeInstanceOf(MissionControlError);
        expect(error).toBeInstanceOf(Error);
    });

    it("should have correct name and default message", () => {
        const error = new CycleDetectedError();
        expect(error.name).toBe("CycleDetectedError");
        expect(error.message).toBe("Cycle detected in task dependency graph");
    });

    it("should accept custom message", () => {
        const error = new CycleDetectedError("Custom cycle message");
        expect(error.name).toBe("CycleDetectedError");
        expect(error.message).toBe("Custom cycle message");
    });
});

describe("TaskLockedError", () => {
    it("should extend MissionControlError", () => {
        const error = new TaskLockedError("task-123", "agent-456");
        expect(error).toBeInstanceOf(MissionControlError);
        expect(error).toBeInstanceOf(Error);
    });

    it("should have correct name and formatted message", () => {
        const error = new TaskLockedError("task-123", "agent-456");
        expect(error.name).toBe("TaskLockedError");
        expect(error.message).toBe("Task task-123 is already locked by agent agent-456");
    });
});

describe("TaskNotFoundError", () => {
    it("should extend MissionControlError", () => {
        const error = new TaskNotFoundError("task-123");
        expect(error).toBeInstanceOf(MissionControlError);
        expect(error).toBeInstanceOf(Error);
    });

    it("should have correct name and formatted message", () => {
        const error = new TaskNotFoundError("task-123");
        expect(error.name).toBe("TaskNotFoundError");
        expect(error.message).toBe("Task with id task-123 not found");
    });
});

describe("MissionNotFoundError", () => {
    it("should extend MissionControlError", () => {
        const error = new MissionNotFoundError("mission-123");
        expect(error).toBeInstanceOf(MissionControlError);
        expect(error).toBeInstanceOf(Error);
    });

    it("should have correct name and formatted message", () => {
        const error = new MissionNotFoundError("mission-123");
        expect(error.name).toBe("MissionNotFoundError");
        expect(error.message).toBe("Mission with id mission-123 not found");
    });
});

describe("InvalidOperationError", () => {
    it("should extend MissionControlError", () => {
        const error = new InvalidOperationError("Invalid operation");
        expect(error).toBeInstanceOf(MissionControlError);
        expect(error).toBeInstanceOf(Error);
    });

    it("should have correct name and message", () => {
        const error = new InvalidOperationError("Custom invalid message");
        expect(error.name).toBe("InvalidOperationError");
        expect(error.message).toBe("Custom invalid message");
    });
});