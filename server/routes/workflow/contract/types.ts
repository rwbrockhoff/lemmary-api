import type { z } from 'zod';
import type {
	CreateWorkflowStageRequestSchema,
	UpdateWorkflowStageRequestSchema,
	ReorderWorkflowStagesRequestSchema,
	DeleteItemStageQuerySchema,
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
export type DeleteItemStageQuery = z.infer<typeof DeleteItemStageQuerySchema>;
