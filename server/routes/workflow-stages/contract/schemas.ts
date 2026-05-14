import { z } from 'zod';

export const UpdateWorkflowStageRequestSchema = z
	.object({
		name: z.string().trim().min(1).max(100),
	})
	.strict();

export const UpdateWorkflowStageResponseSchema = z
	.object({
		id: z.uuid(),
		name: z.string(),
	})
	.strict();
