import { z } from 'zod';
import { CUSTOMER_TIERS } from '../../../utils/customer-tier.js';

export const VariantOptionSchema = z.object({
	name: z.string(),
	value: z.string(),
});

const OrderColumnsSchema = z.object({
	id: z.string(),
	store_id: z.string(),
	platform_order_id: z.string(),
	order_number: z.string(),
	customer_name: z.string(),
	customer_email: z.string().nullable(),
	order_date: z.date(),
	fulfillment_status: z.string(),
	due_date: z.date().nullable(),
	workflow_stage_id: z.string().nullable(),
	subtotal: z.string().nullable(),
	shipping_total: z.string().nullable(),
	grand_total: z.string().nullable(),
	promo_code: z.string().nullable(),
	discount_total: z.string(),
	shipping_method: z.string().nullable(),
	order_notes: z.string().nullable(),
	fulfilled_on: z.date().nullable(),
	tracking_number: z.string().nullable(),
	tracking_url: z.string().nullable(),
	carrier_name: z.string().nullable(),
	currency: z.string(),
	created_at: z.date(),
	updated_at: z.date(),
});

export const OrderItemSchema = z.object({
	id: z.string(),
	order_id: z.string(),
	platform_line_item_id: z.string().nullable(),
	platform_sku: z.string().nullable(),
	product_name: z.string(),
	variant_label: z.array(VariantOptionSchema).nullable(),
	quantity: z.number(),
	unit_price: z.string().nullable(),
	image_url: z.string().nullable(),
	workflow_stage_id: z.string().nullable(),
	created_at: z.date(),
	updated_at: z.date(),
});

export const OrderSummarySchema = OrderColumnsSchema.extend({
	item_count: z.number(),
	items_completed: z.number(),
	workflow_stage_name: z.string().nullable(),
	workflow_stage_color: z.string().nullable(),
	batch_name: z.string().nullable(),
	batch_id: z.string().nullable(),
	order_url: z.string().nullable(),
	customer_tier: z.enum(CUSTOMER_TIERS).nullable(),
});

export const OrderWithItemsSchema = OrderSummarySchema.extend({
	items: z.array(OrderItemSchema),
});

export const GetOrdersQuerySchema = z.object({
	status: z.enum(['pending', 'completed']).default('pending'),
	limit: z.coerce.number().int().min(1).max(50).default(15),
	offset: z.coerce.number().int().min(0).default(0),
});

export const GetOrdersResponseSchema = z.object({
	orders: z.array(OrderWithItemsSchema),
	hasMore: z.boolean(),
	lastSyncedAt: z.date().nullable(),
});

export const OrderSchema = OrderColumnsSchema;

export const OrderDetailSchema = OrderColumnsSchema.extend({
	workflow_stage_name: z.string().nullable(),
	order_url: z.string().nullable(),
	customer_tier: z.enum(CUSTOMER_TIERS).nullable(),
	items: z.array(
		OrderItemSchema.extend({ workflow_stage_name: z.string().nullable() }),
	),
});

export const WorkflowStageSchema = z.object({
	id: z.string(),
	store_id: z.string(),
	name: z.string(),
	position: z.number(),
	color: z.string().nullable(),
	is_default: z.boolean(),
	is_complete: z.boolean(),
	archived_at: z.date().nullable(),
	created_at: z.date(),
	updated_at: z.date(),
});

export const WorkflowStageWithOrdersSchema = WorkflowStageSchema.extend({
	orders: z.array(OrderSummarySchema),
	hasMore: z.boolean(),
});

export const WorkflowBoardResponseSchema = z.object({
	stages: z.array(WorkflowStageWithOrdersSchema),
	activeBatches: z.array(z.object({ id: z.string(), name: z.string() })),
});

export const SyncOrdersResponseSchema = z.object({
	synced: z.number(),
	storeId: z.string(),
});

export const CompleteItemsResponseSchema = z.object({
	orderId: z.string(),
	stageId: z.string(),
});

export const OrderIdParamSchema = z.object({
	orderId: z.uuid(),
});

export const OrderItemParamsSchema = z.object({
	orderId: z.uuid(),
	itemId: z.uuid(),
});

export const UpdateOrderStageBodySchema = z.object({
	stageId: z.uuid(),
});

export const UpdateOrderNotesBodySchema = z.object({
	notes: z.string(),
});
