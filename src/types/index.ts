import { z } from 'zod';
import {
  MissionStatusSchema,
  MissionSchema,
  TaskStatusSchema,
  TaskSchema,
  DependencySchema,
  CreateTaskInputSchema,
} from './schemas';

export type MissionStatus = z.infer<typeof MissionStatusSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export type Mission = z.infer<typeof MissionSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Dependency = z.infer<typeof DependencySchema>;

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
