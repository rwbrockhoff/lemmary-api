import type { z } from 'zod';
import type {
	CreateWorkflowStageRequestSchema,
	UpdateWorkflowStageRequestSchema,
	ReorderWorkflowStagesRequestSchema,
} from './schemas.js';

export type CreateWorkflowStageRequest = z.infer<
	typeof CreateWorkflowStageRequestSchema
>;
export type UpdateWorkflowStageRequest = z.infer<
	typeof UpdateWorkflowStageRequestSchema
>;
export type ReorderWorkflowStagesRequest = z.infer<
	typeof ReorderWorkflowStagesRequestSchema
>;
