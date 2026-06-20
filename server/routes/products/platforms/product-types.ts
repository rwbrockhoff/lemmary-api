import type {
	NewProduct,
	NewProductVariant,
} from '../../../db/database-types.js';

// The platform-agnostic product shape every adapter maps into
export type NormalizedProduct = {
	product: Omit<NewProduct, 'store_id'>;
	variants: Omit<NewProductVariant, 'product_id'>[];
};
