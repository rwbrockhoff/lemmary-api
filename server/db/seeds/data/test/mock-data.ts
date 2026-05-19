export const ORDER_STAGES = [
	{
		name: 'New',
		position: 0,
		color: 'slate',
		is_default: true,
		is_complete: false,
	},
	{
		name: 'Cutting',
		position: 1,
		color: 'clay',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Stitching',
		position: 2,
		color: 'cobalt',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Quality Check',
		position: 3,
		color: 'sage',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Finished',
		position: 4,
		color: 'pine',
		is_default: false,
		is_complete: true,
	},
];

export const ITEM_STAGES = [
	{
		name: 'Not Started',
		position: 0,
		color: 'slate',
		is_default: true,
		is_complete: false,
	},
	{
		name: 'In Progress',
		position: 1,
		color: 'cobalt',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Finished',
		position: 2,
		color: 'pine',
		is_default: false,
		is_complete: true,
	},
];

export const STAGE_HOURS: Record<string, [number, number]> = {
	New: [4, 12],
	Cutting: [12, 24],
	Stitching: [24, 48],
	'Quality Check': [4, 12],
};

export const PRODUCTS = [
	{ name: 'Test Wallet', sku: 'TW-001', price: 50 },
	{ name: 'Test Bag', sku: 'TB-001', price: 180 },
];

export const MATERIAL_TYPES = [
	{
		name: 'Leather',
		measurement: 'area' as const,
		unit: 'pieces' as const,
		tracks_color: true,
		tracks_size: false,
	},
	{
		name: 'Thread',
		measurement: 'linear' as const,
		unit: 'inches' as const,
		tracks_color: true,
		tracks_size: false,
	},
];

export const MATERIALS = [
	{ type: 'Leather', color: 'Black' },
	{ type: 'Leather', color: 'Tan' },
	{ type: 'Thread', color: 'Black' },
	{ type: 'Thread', color: 'White' },
];

export const BOM_ITEMS = [
	{
		sku: 'TW-001',
		materialType: 'Leather',
		color: 'Black',
		quantity: 1,
		length: null,
		piece: 'Body',
	},
	{
		sku: 'TW-001',
		materialType: 'Thread',
		color: 'Black',
		quantity: 1,
		length: 24,
		piece: 'Stitching',
	},
	{
		sku: 'TB-001',
		materialType: 'Leather',
		color: 'Tan',
		quantity: 3,
		length: null,
		piece: 'Body',
	},
	{
		sku: 'TB-001',
		materialType: 'Thread',
		color: 'White',
		quantity: 1,
		length: 60,
		piece: 'Stitching',
	},
];
