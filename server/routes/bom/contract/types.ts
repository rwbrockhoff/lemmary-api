import type { z } from 'zod';
import type {
	CreateBomItemRequestSchema,
	UpdateBomItemRequestSchema,
	GetOrCreateMaterialRequestSchema,
	CopyBomRequestSchema,
	BomVariantQuerySchema,
	MaterialTypeSearchQuerySchema,
	MaterialSearchQuerySchema,
	SuggestionsQuerySchema,
} from './schemas.js';

export type CreateBomItemRequest = z.infer<typeof CreateBomItemRequestSchema>;
export type UpdateBomItemRequest = z.infer<typeof UpdateBomItemRequestSchema>;
export type GetOrCreateMaterialRequest = z.infer<
	typeof GetOrCreateMaterialRequestSchema
>;
export type CopyBomRequest = z.infer<typeof CopyBomRequestSchema>;
export type BomVariantQuery = z.infer<typeof BomVariantQuerySchema>;
export type MaterialTypeSearchQuery = z.infer<
	typeof MaterialTypeSearchQuerySchema
>;
export type MaterialSearchQuery = z.infer<typeof MaterialSearchQuerySchema>;
export type SuggestionsQuery = z.infer<typeof SuggestionsQuerySchema>;
