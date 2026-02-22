import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface Database {
	users: UserTable;
	stores: StoreTable;
	orders: OrderTable;
	order_items: OrderItemTable;
	bom_material_types: BomMaterialTypeTable;
	bom_items: BomItemTable;
}

export interface UserTable {
	id: Generated<string>;
	email: string;
	full_name: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export interface StoreTable {
	id: Generated<string>;
	user_id: string;
	platform: 'squarespace' | 'shopify' | 'etsy';
	store_name: string;
	api_key: string;
	platform_config: Record<string, unknown> | null;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type Store = Selectable<StoreTable>;
export type NewStore = Insertable<StoreTable>;
export type StoreUpdate = Updateable<StoreTable>;

export interface OrderTable {
	id: Generated<string>;
	store_id: string;
	platform_order_id: string;
	order_number: string;
	customer_name: string;
	customer_email: string | null;
	order_date: Date;
	fulfillment_status: Generated<string>;
	subtotal: string | null;
	shipping_total: string | null;
	grand_total: string | null;
	currency: Generated<string>;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type Order = Selectable<OrderTable>;
export type NewOrder = Insertable<OrderTable>;
export type OrderUpdate = Updateable<OrderTable>;

export interface OrderItemTable {
	id: Generated<string>;
	order_id: string;
	platform_sku: string | null;
	product_name: string;
	variant_label: string | null;
	quantity: number;
	unit_price: string | null;
	image_url: string | null;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type OrderItem = Selectable<OrderItemTable>;
export type NewOrderItem = Insertable<OrderItemTable>;
export type OrderItemUpdate = Updateable<OrderItemTable>;

export interface BomMaterialTypeTable {
	id: Generated<string>;
	store_id: string;
	name: string;
	measurement: 'count' | 'linear' | 'area';
	unit: 'pieces' | 'inches' | 'sq_ft' | 'yards';
	tracks_color: Generated<boolean>;
	tracks_dimensions: Generated<boolean>;
	position: number;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type BomMaterialType = Selectable<BomMaterialTypeTable>;
export type NewBomMaterialType = Insertable<BomMaterialTypeTable>;
export type BomMaterialTypeUpdate = Updateable<BomMaterialTypeTable>;

export interface BomItemTable {
	id: Generated<string>;
	store_id: string;
	material_type_id: string;
	platform_sku: string;
	product_name: string;
	variant: string | null;
	piece: string;
	color: string | null;
	length: string | null;
	width: string | null;
	quantity: number;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type BomItem = Selectable<BomItemTable>;
export type NewBomItem = Insertable<BomItemTable>;
export type BomItemUpdate = Updateable<BomItemTable>;
