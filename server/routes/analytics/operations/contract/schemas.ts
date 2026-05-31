import { z } from 'zod';

export const OperationsQuerySchema = z.object({
	range: z.enum(['30', '90', '365']).default('30'),
});

export const OperationsResponseSchema = z.object({
	range: z.number(),
	bucket: z.enum(['day', 'week', 'month']),
	revenue: z.object({
		current: z.string(),
		previous: z.string(),
		changePercent: z.number(),
	}),
	avgOrderValue: z.object({
		current: z.string(),
		previous: z.string(),
		changePercent: z.number(),
	}),
	ordersInProgress: z.number(),
	ordersCompletedInPeriod: z.number(),
	avgLeadTime: z.object({
		days: z.number().nullable(),
		target: z.number().nullable(),
	}),
	dueSoon: z.array(
		z.object({
			id: z.string(),
			orderNumber: z.string(),
			customerName: z.string(),
			orderDate: z.date(),
			dueDate: z.date().nullable(),
			daysUntilDue: z.number().nullable(),
			grandTotal: z.string().nullable(),
			itemCount: z.number(),
			itemsCompleted: z.number(),
			workflowStageName: z.string().nullable(),
			workflowStageColor: z.string().nullable(),
		}),
	),
	ordersTrend: z.array(
		z.object({
			date: z.string(),
			count: z.number(),
			revenue: z.string(),
			avgOrderValue: z.string(),
		}),
	),
});
