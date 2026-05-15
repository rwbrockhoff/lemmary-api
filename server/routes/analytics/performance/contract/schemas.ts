import { z } from 'zod';

export const PerformanceQuerySchema = z.object({
	range: z.enum(['30', '90', '365']).default('30'),
});

export const StageBottleneckSchema = z.object({
	stages: z.array(
		z.object({
			stageId: z.uuid(),
			stageName: z.string(),
			stageColor: z.string().nullable(),
			avgDays: z.number(),
			transitionCount: z.number(),
		}),
	),
});

export const PerformanceResponseSchema = z
	.object({
		stageBottleneck: StageBottleneckSchema,
	})
	.strict();
