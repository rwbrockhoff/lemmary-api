import type { z } from 'zod';
import type { UpdateMaterialRequestSchema } from './schemas.js';

export type UpdateMaterialRequest = z.infer<typeof UpdateMaterialRequestSchema>;
