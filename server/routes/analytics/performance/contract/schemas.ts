import { z } from 'zod';

export const PerformanceQuerySchema = z.object({
	range: z.enum(['30', '90', '365']).default('30'),
});

export const StageBottleneckSchema = z.object({
	stages: z.array(
		z.object({
			stageId: z.uuid(),
			stageName: z.string(),
			stageColor: z.string().nullable(),
			avgDays: z.number(),
			transitionCount: z.number(),
		}),
	),
});

export const TopProductsSchema = z.object({
	products: z.array(
		z.object({
			productName: z.string(),
			totalUnits: z.number(),
			totalRevenue: z.number(),
			orderCount: z.number(),
		}),
	),
});

export const CustomerMixSchema = z.object({
	newCount: z.number(),
	returningCount: z.number(),
	totalCount: z.number(),
	priorNewCount: z.number(),
	priorReturningCount: z.number(),
	priorTotalCount: z.number(),
});

export const CouponUsageSchema = z.object({
	withPromoCount: z.number(),
	noPromoCount: z.number(),
	totalCount: z.number(),
	avgDiscount: z.number(),
	priorWithPromoCount: z.number(),
	priorNoPromoCount: z.number(),
	priorTotalCount: z.number(),
});

export const OnTimeDeliverySchema = z.object({
	onTimeCount: z.number(),
	totalCount: z.number(),
	priorOnTimeCount: z.number(),
	priorTotalCount: z.number(),
});

export const MaterialConsumptionSchema = z.object({
	materials: z.array(
		z.object({
			materialType: z.string(),
			color: z.string().nullable(),
			measurement: z.enum(['linear', 'area', 'count']),
			currentQty: z.number(),
			priorQty: z.number(),
		}),
	),
});

export const PerformanceResponseSchema = z
	.object({
		stageBottleneck: StageBottleneckSchema,
		topProducts: TopProductsSchema,
		customerMix: CustomerMixSchema.nullable(),
		couponUsage: CouponUsageSchema.nullable(),
		onTimeDelivery: OnTimeDeliverySchema.nullable(),
		materialConsumption: MaterialConsumptionSchema,
	})
	.strict();
