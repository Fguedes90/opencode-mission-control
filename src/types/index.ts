import { z } from 'zod';
import {
  MissionStatusSchema,
  MissionSchema,
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskSchema,
  DependencySchema,
  CreateTaskInputSchema,
} from './schemas';

export type MissionStatus = z.infer<typeof MissionStatusSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export type Mission = z.infer<typeof MissionSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Dependency = z.infer<typeof DependencySchema>;

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
