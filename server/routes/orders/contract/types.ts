import type { z } from 'zod';
import type { GetOrdersQuerySchema } from './schemas.js';

export type GetOrdersQuery = z.infer<typeof GetOrdersQuerySchema>;
