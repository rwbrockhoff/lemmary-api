import { z } from 'zod';
import { WORKFLOW_STAGE_COLORS } from '../../../config/workflow-stage-colors.js';

export const WorkflowStageColorSchema = z.enum(WORKFLOW_STAGE_COLORS);

export const CreateWorkflowStageRequestSchema = z
	.object({
		name: z.string().trim().min(1).max(100),
		color: WorkflowStageColorSchema.optional(),
	})
	.strict();

export const UpdateWorkflowStageRequestSchema = z
	.object({
		name: z.string().trim().min(1).max(100).optional(),
		color: WorkflowStageColorSchema.optional(),
	})
	.strict()
	.refine((data) => data.name !== undefined || data.color !== undefined, {
		message: 'At least one of name or color must be provided',
	});

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
