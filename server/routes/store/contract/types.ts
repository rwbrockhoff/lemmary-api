import type { z } from 'zod';
import type {
	UpdateStoreRequestSchema,
	CreateStoreRequestSchema,
} from './schemas.js';

export type UpdateStoreRequest = z.infer<typeof UpdateStoreRequestSchema>;
export type CreateStoreRequest = z.infer<typeof CreateStoreRequestSchema>;
