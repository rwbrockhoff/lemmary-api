import type { z } from 'zod';
import type {
	CreateBatchRequestSchema,
	UpdateBatchRequestSchema,
	ToggleCompleteBodySchema,
	UpdateCompletedQtyBodySchema,
} from './schemas.js';

export type CreateBatchRequest = z.infer<typeof CreateBatchRequestSchema>;
export type UpdateBatchRequest = z.infer<typeof UpdateBatchRequestSchema>;
export type ToggleCompleteBody = z.infer<typeof ToggleCompleteBodySchema>;
export type UpdateCompletedQtyBody = z.infer<
	typeof UpdateCompletedQtyBodySchema
>;
