import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface Database {
	users: UserTable;
	stores: StoreTable;
	order_workflow_stages: OrderWorkflowStageTable;
	order_item_workflow_stages: OrderItemWorkflowStageTable;
	orders: OrderTable;
	order_items: OrderItemTable;
	bom_material_types: BomMaterialTypeTable;
	materials: MaterialTable;
	bom_items: BomItemTable;
	production_batches: ProductionBatchTable;
	production_batch_orders: ProductionBatchOrderTable;
	production_batch_order_items: ProductionBatchOrderItemTable;
	production_batch_items: ProductionBatchItemTable;
	production_batch_materials: ProductionBatchMaterialTable;
	products: ProductTable;
	product_variants: ProductVariantTable;
}

export interface UserTable {
	id: string;
	email: string;
	first_name: string | null;
	last_name: string | null;
	avatar_url: string | null;
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
	store_access_token: Buffer;
	platform_config: Record<string, unknown> | null;
	lead_time_days: number | null;
	last_synced_at: Date | null;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type Store = Selectable<StoreTable>;
export type NewStore = Insertable<StoreTable>;
export type StoreUpdate = Updateable<StoreTable>;

export interface OrderWorkflowStageTable {
	id: Generated<string>;
	store_id: string;
	name: string;
	position: number;
	color: string | null;
	is_default: Generated<boolean>;
	is_complete: Generated<boolean>;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type OrderWorkflowStage = Selectable<OrderWorkflowStageTable>;
export type NewOrderWorkflowStage = Insertable<OrderWorkflowStageTable>;

export interface OrderItemWorkflowStageTable {
	id: Generated<string>;
	store_id: string;
	name: string;
	position: number;
	color: string | null;
	is_default: Generated<boolean>;
	is_complete: Generated<boolean>;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type OrderItemWorkflowStage = Selectable<OrderItemWorkflowStageTable>;
export type NewOrderItemWorkflowStage = Insertable<OrderItemWorkflowStageTable>;

export interface OrderTable {
	id: Generated<string>;
	store_id: string;
	platform_order_id: string;
	order_number: string;
	customer_name: string;
	customer_email: string | null;
	order_date: Date;
	fulfillment_status: Generated<string>;
	due_date: Date | null;
	workflow_stage_id: string | null;
	subtotal: string | null;
	shipping_total: string | null;
	grand_total: string | null;
	shipping_method: string | null;
	order_notes: string | null;
	fulfilled_on: Date | null;
	tracking_number: string | null;
	tracking_url: string | null;
	carrier_name: string | null;
	currency: Generated<string>;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type Order = Selectable<OrderTable>;
export type NewOrder = Insertable<OrderTable>;
export type OrderUpdate = Updateable<OrderTable>;

export type VariantOption = { name: string; value: string };

export interface OrderItemTable {
	id: Generated<string>;
	order_id: string;
	platform_line_item_id: string | null;
	platform_sku: string | null;
	product_name: string;
	variant_label: VariantOption[] | null;
	quantity: number;
	unit_price: string | null;
	image_url: string | null;
	workflow_stage_id: string | null;
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
	tracks_size: Generated<boolean>;
	position: number;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type BomMaterialType = Selectable<BomMaterialTypeTable>;
export type NewBomMaterialType = Insertable<BomMaterialTypeTable>;
export type BomMaterialTypeUpdate = Updateable<BomMaterialTypeTable>;

export interface MaterialTable {
	id: Generated<string>;
	store_id: string;
	material_type_id: string;
	color: string | null;
	size: string | null;
	purchase_url: string | null;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type Material = Selectable<MaterialTable>;
export type NewMaterial = Insertable<MaterialTable>;
export type MaterialUpdate = Updateable<MaterialTable>;

export interface BomItemTable {
	id: Generated<string>;
	store_id: string;
	material_id: string | null;
	measurement: 'count' | 'linear' | 'area';
	platform_sku: string;
	product_name: string;
	variant: string | null;
	piece: string;
	length: string | null;
	quantity: number;
	position: Generated<number>;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type BomItem = Selectable<BomItemTable>;
export type NewBomItem = Insertable<BomItemTable>;
export type BomItemUpdate = Updateable<BomItemTable>;

export interface ProductionBatchTable {
	id: Generated<string>;
	store_id: string;
	name: string;
	status: Generated<string>;
	due_date: Date | null;
	completed_at: Date | null;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type ProductionBatch = Selectable<ProductionBatchTable>;
export type NewProductionBatch = Insertable<ProductionBatchTable>;
export type ProductionBatchUpdate = Updateable<ProductionBatchTable>;

export interface ProductionBatchOrderTable {
	id: Generated<string>;
	batch_id: string;
	order_id: string;
	completed: Generated<boolean>;
	created_at: Generated<Date>;
}

export type ProductionBatchOrder = Selectable<ProductionBatchOrderTable>;
export type NewProductionBatchOrder = Insertable<ProductionBatchOrderTable>;

export interface ProductionBatchOrderItemTable {
	id: Generated<string>;
	batch_id: string;
	batch_order_id: string;
	platform_sku: string | null;
	product_name: string;
	variant_label: VariantOption[] | null;
	quantity: number;
	completed: Generated<boolean>;
	completed_qty: Generated<number>;
	created_at: Generated<Date>;
}

export type ProductionBatchOrderItem =
	Selectable<ProductionBatchOrderItemTable>;
export type NewProductionBatchOrderItem =
	Insertable<ProductionBatchOrderItemTable>;

export interface ProductionBatchItemTable {
	id: Generated<string>;
	batch_id: string;
	platform_sku: string | null;
	product_name: string;
	variant_label: VariantOption[] | null;
	quantity: number;
	completed: Generated<boolean>;
	created_at: Generated<Date>;
}

export type ProductionBatchItem = Selectable<ProductionBatchItemTable>;
export type NewProductionBatchItem = Insertable<ProductionBatchItemTable>;

export interface ProductionBatchMaterialTable {
	id: Generated<string>;
	batch_id: string;
	category: string;
	product_name: string | null;
	material_type: string | null;
	piece: string;
	color: string | null;
	width: string | null;
	quantity: string;
	completed: Generated<boolean>;
	completed_qty: Generated<number>;
	created_at: Generated<Date>;
}

export type ProductionBatchMaterial = Selectable<ProductionBatchMaterialTable>;
export type NewProductionBatchMaterial =
	Insertable<ProductionBatchMaterialTable>;

export interface ProductTable {
	id: Generated<string>;
	store_id: string;
	platform_product_id: string;
	name: string;
	description: string | null;
	slug: string | null;
	is_visible: Generated<boolean>;
	image_url: string | null;
	product_url: string | null;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type Product = Selectable<ProductTable>;
export type NewProduct = Insertable<ProductTable>;
export type ProductUpdate = Updateable<ProductTable>;

export interface ProductVariantTable {
	id: Generated<string>;
	product_id: string;
	platform_variant_id: string;
	platform_sku: string | null;
	name: string;
	price: string | null;
	sale_price: string | null;
	on_sale: Generated<boolean>;
	stock_quantity: number | null;
	stock_unlimited: Generated<boolean>;
	image_url: string | null;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export type ProductVariant = Selectable<ProductVariantTable>;
export type NewProductVariant = Insertable<ProductVariantTable>;
export type ProductVariantUpdate = Updateable<ProductVariantTable>;
