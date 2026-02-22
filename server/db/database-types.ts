import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface Database {
	stores: StoreTable;
}

export interface StoreTable {
	id: Generated<number>;
	name: string;
	platform: 'squarespace' | 'shopify' | 'etsy';
	api_key: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type Store = Selectable<StoreTable>;
export type NewStore = Insertable<StoreTable>;
export type StoreUpdate = Updateable<StoreTable>;
