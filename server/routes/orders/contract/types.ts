import type { z } from 'zod';
import type {
	GetOrdersQuerySchema,
	CreateCustomOrderSchema,
	UpdateCustomOrderSchema,
	CreateWorkOrderSchema,
	UpdateWorkOrderSchema,
	UpdateOrderLineItemSchema,
	CreateReworkSchema,
} from './schemas.js';

export type GetOrdersQuery = z.infer<typeof GetOrdersQuerySchema>;
export type CreateCustomOrder = z.infer<typeof CreateCustomOrderSchema>;
export type UpdateCustomOrder = z.infer<typeof UpdateCustomOrderSchema>;
export type CreateWorkOrder = z.infer<typeof CreateWorkOrderSchema>;
export type UpdateWorkOrder = z.infer<typeof UpdateWorkOrderSchema>;
export type UpdateOrderLineItem = z.infer<typeof UpdateOrderLineItemSchema>;
export type CreateRework = z.infer<typeof CreateReworkSchema>;
