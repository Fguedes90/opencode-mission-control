import { MissionStore } from "../persistence/MissionStore";
import { generateSmartId } from "../utils/id";
import { Mission, Task, Dependency, TaskStatus, CreateTaskInput } from "../types";
import { CreateTaskInputSchema } from "../types/schemas";
import { MissionNotFoundError, TaskNotFoundError, InvalidOperationError, TaskLockedError, CycleDetectedError } from "../types/errors";

export class MissionManager {
    private store: MissionStore;

    constructor(store: MissionStore) {
        this.store = store;
    }

    createMission(id: string, title: string): Mission {
        const existing = this.store.getMission(id);
        if (existing) {
            throw new InvalidOperationError(`Mission ${id} already exists`);
        }

        const mission: Mission = {
            id,
            title,
            status: 'active',
            created_at: new Date().toISOString()
        };
        this.store.createMission(mission);
        return mission;
    }

    createTask(missionId: string, title: string, description: string = '', priority: any = 4, acceptanceCriteria?: string): Task {
        const input: CreateTaskInput = {
            mission_id: missionId,
            title,
            description,
            priority: priority !== undefined ? Number(priority) : 2,
            acceptance_criteria: acceptanceCriteria,
            assignee: null,
            metadata: {},
        };
        const validatedInput = CreateTaskInputSchema.parse(input);

        const mission = this.store.getMission(validatedInput.mission_id);
        if (!mission) throw new MissionNotFoundError(validatedInput.mission_id);

        const task: Task = {
            id: generateSmartId(mission.title),
            mission_id: validatedInput.mission_id,
            title: validatedInput.title,
            description: validatedInput.description,
            status: 'pending',
            priority: validatedInput.priority!,
            assignee: validatedInput.assignee,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            acceptance_criteria: validatedInput.acceptance_criteria,
            metadata: validatedInput.metadata
        };

        this.store.createTask(task);
        return task;
    }

    linkTasks(blockerId: string, blockedId: string): void {
        this.store.runTransaction(() => {
            const blocker = this.store.getTask(blockerId);
            if (!blocker) throw new TaskNotFoundError(blockerId);

            const blocked = this.store.getTask(blockedId);
            if (!blocked) throw new TaskNotFoundError(blockedId);

        if (blocker.mission_id !== blocked.mission_id) {
            throw new InvalidOperationError(`Cannot link tasks from different missions: ${blocker.mission_id} vs ${blocked.mission_id}`);
        }

        if (this.store.hasCycle(blockerId, blockedId)) {
            throw new CycleDetectedError(`Cycle detected: Task ${blockedId} is already a dependency of ${blockerId}`);
        }

            this.store.addDependency({
                blocker_id: blockerId,
                blocked_id: blockedId,
                mission_id: blocker.mission_id
            });
        });
    }

    claimTask(taskId: string, agentId: string): Task {
        return this.store.runTransaction(() => {
            const task = this.store.getTask(taskId);
            if (!task) throw new TaskNotFoundError(taskId);
            // OR, we can strictly enforce: Is it blocked?

            const blockers = this.store.getDependencies(taskId);
            for (const blockerId of blockers) {
                const blocker = this.store.getTask(blockerId);
                if (blocker && blocker.status !== 'completed') {
                    throw new InvalidOperationError(`Task ${taskId} is blocked by ${blockerId}`);
                }
            }

            if (task.assignee && task.assignee !== agentId) {
                throw new TaskLockedError(taskId, task.assignee);
            }

            if (task.status === 'completed') {
                throw new InvalidOperationError(`Task ${taskId} is already completed`);
            }

            this.store.updateTaskStatus(taskId, 'in_progress', agentId);
            return this.store.getTask(taskId)!;
        });
    }

    updateTaskStatus(taskId: string, status: TaskStatus, resultSummary: any = null): Task {
        const task = this.store.getTask(taskId);
        if (!task) throw new TaskNotFoundError(taskId);

            let targetAssignee = task.assignee;
        if (status === 'pending' || status === 'ready') {
            targetAssignee = null;
        }

        let metadataString: string | null = null;
        if (resultSummary) {
            const newMetadata = { ...task.metadata, result_summary: resultSummary };
            metadataString = JSON.stringify(newMetadata);
        }

        this.store.updateTaskStatus(taskId, status, targetAssignee, metadataString);

        return this.store.getTask(taskId)!;
    }

    getReadyTasks(missionId: string, limit: number): Task[] {
        return this.store.getReadyTasks(missionId, limit);
    }

    getAllTasks(missionId: string): Task[] {
        return this.store.getTasksByMission(missionId);
    }

    getActiveTasks(missionId: string): Task[] {
        return this.store.getTasksByMission(missionId).filter(t => t.status === 'in_progress');
    }

    getDependencies(taskId: string): string[] {
        return this.store.getDependencies(taskId);
    }
}
