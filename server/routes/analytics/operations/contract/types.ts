import type { z } from 'zod';
import type { OperationsResponseSchema } from './schemas.js';

export type OperationsData = z.infer<typeof OperationsResponseSchema>;
