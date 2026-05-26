import { z } from 'zod';

const VariantOptionSchema = z.object({
	name: z.string(),
	value: z.string(),
});

const ProductionSummaryItemSchema = z.object({
	platform_sku: z.string().nullable(),
	product_name: z.string(),
	variant_label: z.array(VariantOptionSchema).nullable(),
	total_quantity: z.number(),
});

export const ProductionSummaryResponseSchema = z.array(
	ProductionSummaryItemSchema,
);

const FabricEntrySchema = z.object({
	material_type: z.string(),
	product_name: z.string(),
	piece: z.string(),
	color: z.string(),
	total_quantity: z.number(),
});

const LinearEntrySchema = z.object({
	material_type: z.string().nullable(),
	width: z.number().nullable(),
	total_inches: z.number(),
	total_feet: z.number(),
	feet_to_order: z.number(),
});

const HardwareEntrySchema = z.object({
	material_type: z.string(),
	piece: z.string(),
	total_count: z.number(),
});

const MismatchSchema = z.object({
	platform_sku: z.string().nullable(),
	product_name: z.string(),
	variant_label: z.array(VariantOptionSchema).nullable(),
	product_id: z.string().nullable(),
	variant_id: z.string().nullable(),
});

export const MaterialsReportResponseSchema = z.object({
	fabric: z.array(FabricEntrySchema),
	linear: z.array(LinearEntrySchema),
	hardware: z.array(HardwareEntrySchema),
	mismatches: z.array(MismatchSchema),
});
