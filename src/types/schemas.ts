import { z } from 'zod';

export const MissionStatusSchema = z.enum(['active', 'archived']);

export const TaskStatusSchema = z.enum(['pending', 'ready', 'in_progress', 'review', 'completed', 'failed', 'blocked']);

export const TaskPrioritySchema = z.number().min(0).max(4);

export const DateStringSchema = z.string();

export const MissionSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: MissionStatusSchema,
  created_at: DateStringSchema,
});

export const TaskSchema = z.object({
  id: z.string(),
  mission_id: z.string(),
  title: z.string(),
  description: z.string(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  assignee: z.nullable(z.string()),
  created_at: DateStringSchema,
  updated_at: DateStringSchema,
  acceptance_criteria: z.union([z.string(), z.null()]).optional(),
   metadata: z.record(z.unknown()),
});

export const DependencySchema = z.object({
  blocker_id: z.string(),
  blocked_id: z.string(),
  mission_id: z.string(),
});

// Input schemas
export const CreateTaskInputSchema = z.object({
  mission_id: z.string(),
  title: z.string(),
  description: z.string().optional().default(''),
  priority: TaskPrioritySchema.optional().default(2),
  assignee: z.nullable(z.string()).optional().default(null),
  acceptance_criteria: z.union([z.string(), z.null()]).optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});