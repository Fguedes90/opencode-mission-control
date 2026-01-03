import { Database } from "bun:sqlite";
import { mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { Mission, Task, Dependency, MissionStatus, TaskStatus } from "../types";
import { TaskSchema } from "../types/schemas";
import { MissionNotFoundError, TaskNotFoundError } from "../types/errors";

export class MissionStore {
    private db: Database;
    private dbPath: string;

    constructor(dbPath: string = ".opencode/mission-control/mission.sqlite") {
        this.dbPath = dbPath;
        this.ensureDirectory();
        this.db = new Database(this.dbPath, { create: true });
        this.configurePragma();
        this.migrate();
    }

    private ensureDirectory() {
        const dir = dirname(this.dbPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }

    private configurePragma() {
        this.db.exec("PRAGMA journal_mode = WAL;");
        this.db.exec("PRAGMA synchronous = NORMAL;");
        this.db.exec("PRAGMA foreign_keys = ON;");
    }

    private migrate() {
        // Basic migration strategy: read schema.sql and execute
        // In a real production app we'd have versioned migrations
        // Resolve path relative to THIS file url
        const schemaPath = new URL('./schema.sql', import.meta.url).pathname;
        const schema = readFileSync(schemaPath, "utf-8");

        // Execute line by line or split by semicolon to ensure multiple statements run if specific driver needs it, 
        // but bun:sqlite exec can handle multiple statements usually. 
        // However, if there are issues, we might want to log.
        const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (const stmt of statements) {
            this.db.exec(stmt);
        }
    }

    // --- Transactions ---

    runTransaction<T>(callback: () => T): T {
        const transaction = this.db.transaction(callback);
        return transaction();
    }

    // --- Missions ---

    createMission(mission: Mission): void {
        const stmt = this.db.prepare(`
      INSERT INTO missions (id, title, status, created_at)
      VALUES ($id, $title, $status, $created_at)
    `);
        stmt.run({
            $id: mission.id,
            $title: mission.title,
            $status: mission.status,
            $created_at: mission.created_at
        });
    }

    getMission(id: string): Mission | null {
        const stmt = this.db.prepare("SELECT * FROM missions WHERE id = ?");
        return stmt.get(id) as Mission | null;
    }

    // --- Tasks ---

    createTask(task: Task): void {
        const stmt = this.db.prepare(`
      INSERT INTO tasks (id, mission_id, title, description, status, priority, assignee, created_at, updated_at, acceptance_criteria, metadata)
      VALUES ($id, $mission_id, $title, $description, $status, $priority, $assignee, $created_at, $updated_at, $acceptance_criteria, $metadata)
    `);
        stmt.run({
            $id: task.id,
            $mission_id: task.mission_id,
            $title: task.title,
            $description: task.description,
            $status: task.status,
            $priority: task.priority,
            $assignee: task.assignee,
            $created_at: task.created_at,
            $updated_at: task.updated_at,
            $acceptance_criteria: task.acceptance_criteria || null,
            $metadata: JSON.stringify(task.metadata)
        });
    }

    getTask(id: string): Task | null {
        const stmt = this.db.prepare("SELECT * FROM tasks WHERE id = ?");
        const task = stmt.get(id) as any;
        if (!task) return null;

        return {
            ...task,
            metadata: task.metadata ? JSON.parse(task.metadata) : {}
        };
    }

    updateTaskStatus(id: string, status: TaskStatus, assignee: string | null = null, metadata: string | null = null): void {
        const stmt = this.db.prepare(`
      UPDATE tasks 
      SET status = $status, assignee = $assignee, updated_at = $updated_at, metadata = COALESCE($metadata, metadata)
      WHERE id = $id
    `);
        stmt.run({
            $id: id,
            $status: status,
            $assignee: assignee,
            $updated_at: new Date().toISOString(),
            $metadata: metadata
        });
    }

    // --- Dependencies ---

    addDependency(dependency: Dependency): void {
        const stmt = this.db.prepare(`
      INSERT INTO dependencies (blocker_id, blocked_id, mission_id)
      VALUES ($blocker_id, $blocked_id, $mission_id)
    `);
        stmt.run({
            $blocker_id: dependency.blocker_id,
            $blocked_id: dependency.blocked_id,
            $mission_id: dependency.mission_id
        });
    }

    getDependencies(taskId: string): string[] {
        // Returns IDs of tasks that block the given task
        const stmt = this.db.prepare("SELECT blocker_id FROM dependencies WHERE blocked_id = ?");
        return stmt.all(taskId).map((row: any) => row.blocker_id);
    }

    getDependents(taskId: string): string[] {
        // Returns IDs of tasks blocked by the given task
        const stmt = this.db.prepare("SELECT blocked_id FROM dependencies WHERE blocker_id = ?");
        return stmt.all(taskId).map((row: any) => row.blocked_id);
    }

    // --- Queries ---

    getReadyTasks(missionId: string, limit: number = 10): Task[] {
        // Tasks that are pending AND have no incomplete blockers
        // "Incomplete" means status != 'completed'
        // We also check that the task itself is pending

        const query = `
      SELECT t.* 
      FROM tasks t
      WHERE t.mission_id = $missionId
        AND t.status = 'pending'
        AND NOT EXISTS (
          SELECT 1 
          FROM dependencies d
          JOIN tasks blocker ON d.blocker_id = blocker.id
          WHERE d.blocked_id = t.id
            AND blocker.status != 'completed'
        )
      ORDER BY t.priority ASC, t.created_at ASC
      LIMIT $limit
    `;

        const stmt = this.db.prepare(query);
        const tasks = stmt.all({ $missionId: missionId, $limit: limit }) as any[];

        return tasks.map(t => ({
            ...t,
            metadata: JSON.parse(t.metadata)
        }));
    }

    getTasksByMission(missionId: string): Task[] {
        const stmt = this.db.prepare("SELECT * FROM tasks WHERE mission_id = ?");
        const tasks = stmt.all(missionId) as any[];
        return tasks.map(t => ({
            ...t,
            metadata: JSON.parse(t.metadata)
        }));
    }

    close() {
        this.db.close();
    }
}
