import type { z } from 'zod';
import type {
	GetOrdersQuerySchema,
	CreateCustomOrderSchema,
	UpdateCustomOrderSchema,
	UpdateCustomOrderItemSchema,
} from './schemas.js';

export type GetOrdersQuery = z.infer<typeof GetOrdersQuerySchema>;
export type CreateCustomOrder = z.infer<typeof CreateCustomOrderSchema>;
export type UpdateCustomOrder = z.infer<typeof UpdateCustomOrderSchema>;
export type UpdateCustomOrderItem = z.infer<typeof UpdateCustomOrderItemSchema>;
