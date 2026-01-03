import { describe, it, expect } from "bun:test";
import {
    MissionStatusSchema,
    TaskStatusSchema,
    TaskPrioritySchema,
    DateStringSchema,
    MissionSchema,
    TaskSchema,
    DependencySchema,
    CreateTaskInputSchema
} from "../../src/types/schemas";

describe("MissionStatusSchema", () => {
    it("should parse valid active status", () => {
        expect(MissionStatusSchema.parse("active")).toBe("active");
    });

    it("should parse valid archived status", () => {
        expect(MissionStatusSchema.parse("archived")).toBe("archived");
    });

    it("should reject invalid status", () => {
        expect(() => MissionStatusSchema.parse("invalid")).toThrow();
    });

    it("should reject non-string", () => {
        expect(() => MissionStatusSchema.parse(123)).toThrow();
    });
});

describe("TaskStatusSchema", () => {
    const validStatuses = ['pending', 'ready', 'in_progress', 'review', 'completed', 'failed', 'blocked'] as const;

    it("should parse all valid statuses", () => {
        validStatuses.forEach(status => {
            expect(TaskStatusSchema.parse(status)).toBe(status);
        });
    });

    it("should reject invalid status", () => {
        expect(() => TaskStatusSchema.parse("invalid")).toThrow();
    });
});

describe("TaskPrioritySchema", () => {
    it("should parse valid priorities", () => {
        [0, 1, 2, 3, 4].forEach(priority => {
            expect(TaskPrioritySchema.parse(priority)).toBe(priority);
        });
    });

    it("should reject negative priority", () => {
        expect(() => TaskPrioritySchema.parse(-1)).toThrow();
    });

    it("should reject priority above 4", () => {
        expect(() => TaskPrioritySchema.parse(5)).toThrow();
    });

    it("should reject non-number", () => {
        expect(() => TaskPrioritySchema.parse("2")).toThrow();
    });
});

describe("DateStringSchema", () => {
    it("should parse any string", () => {
        expect(DateStringSchema.parse("2023-01-01")).toBe("2023-01-01");
        expect(DateStringSchema.parse("")).toBe("");
    });

    it("should reject non-string", () => {
        expect(() => DateStringSchema.parse(123)).toThrow();
    });
});

describe("MissionSchema", () => {
    const validMission = {
        id: "mission-123",
        title: "Test Mission",
        status: "active" as const,
        created_at: "2023-01-01"
    };

    it("should parse valid mission", () => {
        const result = MissionSchema.parse(validMission);
        expect(result).toEqual(validMission);
    });

    it("should reject missing id", () => {
        const invalid = {
            title: validMission.title,
            status: validMission.status,
            created_at: validMission.created_at
        };
        expect(() => MissionSchema.parse(invalid)).toThrow();
    });

    it("should reject invalid status", () => {
        const invalid = { ...validMission, status: "invalid" };
        expect(() => MissionSchema.parse(invalid)).toThrow();
    });

    it("should reject non-string title", () => {
        const invalid = { ...validMission, title: 123 };
        expect(() => MissionSchema.parse(invalid)).toThrow();
    });
});

describe("TaskSchema", () => {
    const validTask = {
        id: "task-123",
        mission_id: "mission-123",
        title: "Test Task",
        description: "Description",
        status: "pending" as const,
        priority: 2,
        assignee: null,
        created_at: "2023-01-01",
        updated_at: "2023-01-01",
        acceptance_criteria: null,
        metadata: {}
    };

    it("should parse valid task", () => {
        const result = TaskSchema.parse(validTask);
        expect(result).toEqual(validTask);
    });

    it("should parse task with optional fields omitted", () => {
        const minimalTask = {
            id: "task-123",
            mission_id: "mission-123",
            title: "Test Task",
            description: "Description",
            status: "pending" as const,
            priority: 2,
            assignee: null,
            created_at: "2023-01-01",
            updated_at: "2023-01-01",
            metadata: {}
        };
        const result = TaskSchema.parse(minimalTask);
        expect(result.acceptance_criteria).toBeUndefined();
    });

    it("should reject invalid priority", () => {
        const invalid = { ...validTask, priority: 5 };
        expect(() => TaskSchema.parse(invalid)).toThrow();
    });

    it("should reject missing required field", () => {
        const invalid = {
            mission_id: validTask.mission_id,
            title: validTask.title,
            description: validTask.description,
            status: validTask.status,
            priority: validTask.priority,
            assignee: validTask.assignee,
            created_at: validTask.created_at,
            updated_at: validTask.updated_at,
            metadata: validTask.metadata
        };
        expect(() => TaskSchema.parse(invalid)).toThrow();
    });
});

describe("DependencySchema", () => {
    const validDependency = {
        blocker_id: "task-1",
        blocked_id: "task-2",
        mission_id: "mission-123"
    };

    it("should parse valid dependency", () => {
        const result = DependencySchema.parse(validDependency);
        expect(result).toEqual(validDependency);
    });

    it("should reject missing field", () => {
        const invalid = {
            blocked_id: validDependency.blocked_id,
            mission_id: validDependency.mission_id
        };
        expect(() => DependencySchema.parse(invalid)).toThrow();
    });
});

describe("CreateTaskInputSchema", () => {
    it("should parse minimal input with defaults", () => {
        const input = {
            mission_id: "mission-123",
            title: "Test Task"
        };
        const result = CreateTaskInputSchema.parse(input);
        expect(result).toEqual({
            mission_id: "mission-123",
            title: "Test Task",
            description: "",
            priority: 2,
            assignee: null,
            acceptance_criteria: undefined,
            metadata: {}
        });
    });

    it("should parse full input", () => {
        const input = {
            mission_id: "mission-123",
            title: "Test Task",
            description: "Description",
            priority: 1,
            assignee: "user-123",
            acceptance_criteria: "Criteria"
        };
        const result = CreateTaskInputSchema.parse(input);
        expect(result).toEqual({
            ...input,
            metadata: {}
        });
    });

    it("should reject invalid priority", () => {
        const invalid = {
            mission_id: "mission-123",
            title: "Test Task",
            priority: 5
        };
        expect(() => CreateTaskInputSchema.parse(invalid)).toThrow();
    });

    it("should reject missing required fields", () => {
        const invalid = {
            title: "Test Task"
        };
        expect(() => CreateTaskInputSchema.parse(invalid)).toThrow();
    });
});