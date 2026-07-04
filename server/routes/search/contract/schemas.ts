import { z } from 'zod';

export const SearchQuerySchema = z.object({
	q: z.string(),
});

const SearchOrderSchema = z.object({
	id: z.uuid(),
	order_number: z.string(),
	customer_name: z.string().nullable(),
	order_type: z.string(),
});

const SearchProductSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	image_url: z.string().nullable(),
});

const SearchCustomerSchema = z.object({
	email: z.string(),
	name: z.string(),
});

export const SearchResponseSchema = z.object({
	orders: z.array(SearchOrderSchema),
	products: z.array(SearchProductSchema),
	customers: z.array(SearchCustomerSchema),
});
