import { z } from 'zod';

const VariantOptionSchema = z.object({
	name: z.string(),
	value: z.string(),
});

const BATCH_STATUSES = ['Active', 'Up Next', 'Paused', 'Completed'] as const;

export const CreateBatchRequestSchema = z.object({
	name: z.string().trim().min(1).max(100),
	orderIds: z.array(z.uuid()).min(1),
});

export const UpdateBatchRequestSchema = z
	.object({
		status: z.enum(BATCH_STATUSES).optional(),
		name: z.string().trim().min(1).max(100).optional(),
		orderIds: z.array(z.uuid()).min(1).optional(),
	})
	.refine(
		(data) =>
			data.status !== undefined ||
			data.name !== undefined ||
			data.orderIds !== undefined,
		{ message: 'At least one of status, name, or orderIds must be provided' },
	);

export const ToggleCompleteBodySchema = z.object({
	completed: z.boolean(),
});

export const UpdateCompletedQtyBodySchema = z.object({
	completedQty: z.number().int().min(0),
});

export const BatchIdParamSchema = z.object({
	batchId: z.uuid(),
});

export const BatchSubResourceParamsSchema = z.object({
	batchId: z.uuid(),
	id: z.uuid(),
});

export const BatchSchema = z.object({
	id: z.string(),
	store_id: z.string(),
	name: z.string(),
	status: z.string(),
	due_date: z.date().nullable(),
	completed_at: z.date().nullable(),
	created_at: z.date(),
	updated_at: z.date(),
});

export const BatchOrderSchema = z.object({
	id: z.string(),
	batch_id: z.string(),
	order_id: z.string(),
	completed: z.boolean(),
	created_at: z.date(),
});

export const BatchItemSchema = z.object({
	id: z.string(),
	batch_id: z.string(),
	platform_sku: z.string().nullable(),
	product_name: z.string(),
	variant_label: z.array(VariantOptionSchema).nullable(),
	quantity: z.number(),
	completed: z.boolean(),
	created_at: z.date(),
});

export const BatchOrderItemSchema = z.object({
	id: z.string(),
	batch_id: z.string(),
	batch_order_id: z.string(),
	platform_sku: z.string().nullable(),
	product_name: z.string(),
	variant_label: z.array(VariantOptionSchema).nullable(),
	quantity: z.number(),
	completed: z.boolean(),
	completed_qty: z.number(),
	created_at: z.date(),
});

export const BatchMaterialSchema = z.object({
	id: z.string(),
	batch_id: z.string(),
	category: z.string(),
	product_name: z.string().nullable(),
	material_type: z.string().nullable(),
	piece: z.string(),
	color: z.string().nullable(),
	width: z.string().nullable(),
	quantity: z.string(),
	completed: z.boolean(),
	completed_qty: z.number(),
	created_at: z.date(),
});

export const BatchSummarySchema = BatchSchema.extend({
	order_count: z.number(),
	item_count: z.number(),
	items_completed: z.number(),
});

export const GetBatchesResponseSchema = z.array(BatchSummarySchema);

const BatchDetailOrderSchema = z.object({
	id: z.string(),
	order_id: z.string(),
	completed: z.boolean(),
	order_number: z.string(),
	customer_name: z.string().nullable(),
	order_notes: z.string().nullable(),
	order_date: z.date(),
	due_date: z.date().nullable(),
	grand_total: z.string().nullable(),
	workflow_stage_id: z.string().nullable(),
	workflow_stage_name: z.string().nullable(),
	workflow_stage_color: z.string().nullable(),
});

const BatchDetailOrderItemSchema = z.object({
	id: z.string(),
	order_id: z.string(),
	batch_order_id: z.string(),
	platform_sku: z.string().nullable(),
	product_name: z.string(),
	variant_label: z.array(VariantOptionSchema).nullable(),
	quantity: z.number(),
	workflow_stage_id: z.string().nullable(),
	workflow_stage_name: z.string().nullable(),
	is_complete: z.boolean().nullable(),
});

export const GetBatchResponseSchema = BatchSchema.extend({
	orders: z.array(BatchDetailOrderSchema),
	items: z.array(BatchItemSchema),
	orderItems: z.array(BatchDetailOrderItemSchema),
	materials: z.array(BatchMaterialSchema),
});
