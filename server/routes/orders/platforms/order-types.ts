import type { NewOrder, NewOrderItem } from '../../../db/database-types.js';

// The platform agnostic shape every shop adapter maps into
export type NormalizedOrder = {
	order: Omit<NewOrder, 'store_id'>;
	items: Omit<NewOrderItem, 'order_id'>[];
};
