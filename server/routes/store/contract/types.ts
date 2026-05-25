import type { z } from 'zod';
import type { UpdateStoreRequestSchema } from './schemas.js';

export type UpdateStoreRequest = z.infer<typeof UpdateStoreRequestSchema>;
