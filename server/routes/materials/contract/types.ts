import type { z } from 'zod';
import type {
	CreateMaterialRequestSchema,
	UpdateMaterialRequestSchema,
} from './schemas.js';

export type CreateMaterialRequest = z.infer<typeof CreateMaterialRequestSchema>;
export type UpdateMaterialRequest = z.infer<typeof UpdateMaterialRequestSchema>;
