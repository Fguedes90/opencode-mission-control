export class MissionControlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MissionControlError';
    }
}

export class CycleDetectedError extends MissionControlError {
    constructor(message: string = 'Cycle detected in task dependency graph') {
        super(message);
        this.name = 'CycleDetectedError';
    }
}

export class TaskLockedError extends MissionControlError {
    constructor(taskId: string, agentId: string) {
        super(`Task ${taskId} is already locked by agent ${agentId}`);
        this.name = 'TaskLockedError';
    }
}

export class TaskNotFoundError extends MissionControlError {
    constructor(id: string) {
        super(`Task with id ${id} not found`);
        this.name = 'TaskNotFoundError';
    }
}

export class MissionNotFoundError extends MissionControlError {
    constructor(id: string) {
        super(`Mission with id ${id} not found`);
        this.name = 'MissionNotFoundError';
    }
}

export class InvalidOperationError extends MissionControlError {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidOperationError';
    }
}
