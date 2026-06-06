import type { z } from 'zod';
import type {
	GetOrdersQuerySchema,
	CreateCustomOrderSchema,
} from './schemas.js';

export type GetOrdersQuery = z.infer<typeof GetOrdersQuerySchema>;
export type CreateCustomOrder = z.infer<typeof CreateCustomOrderSchema>;
