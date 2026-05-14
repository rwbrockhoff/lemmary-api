import { z } from 'zod';

export const CreateWorkflowStageRequestSchema = z
	.object({
		name: z.string().trim().min(1).max(100),
		color: z.string().trim().min(1).max(50).optional(),
	})
	.strict();

export const UpdateWorkflowStageRequestSchema = z
	.object({
		name: z.string().trim().min(1).max(100),
	})
	.strict();

export const ReorderWorkflowStagesRequestSchema = z
	.object({
		orderedIds: z.array(z.uuid()).min(1),
	})
	.strict();

export const WorkflowStageResponseSchema = z
	.object({
		id: z.uuid(),
		name: z.string(),
		position: z.number(),
		color: z.string().nullable(),
	})
	.strict();
