export type DemoMaterialType = {
	name: string;
	measurement: 'area' | 'linear' | 'count';
	unit: 'pieces' | 'inches' | 'sq_ft' | 'yards';
	tracks_color: boolean;
	tracks_size: boolean;
};

export const DEMO_MATERIAL_TYPES: DemoMaterialType[] = [
	{
		name: 'Full-Grain Leather',
		measurement: 'area',
		unit: 'pieces',
		tracks_color: true,
		tracks_size: false,
	},
	{
		name: 'Lining Fabric',
		measurement: 'area',
		unit: 'pieces',
		tracks_color: true,
		tracks_size: false,
	},
	{
		name: 'Waxed Thread',
		measurement: 'linear',
		unit: 'inches',
		tracks_color: false,
		tracks_size: false,
	},
	{
		name: 'Zipper',
		measurement: 'linear',
		unit: 'inches',
		tracks_color: false,
		tracks_size: true,
	},
	{
		name: 'Edge Paint',
		measurement: 'count',
		unit: 'pieces',
		tracks_color: false,
		tracks_size: false,
	},
	{
		name: 'Label',
		measurement: 'count',
		unit: 'pieces',
		tracks_color: false,
		tracks_size: false,
	},
	{
		name: 'D-Ring',
		measurement: 'count',
		unit: 'pieces',
		tracks_color: false,
		tracks_size: false,
	},
	{
		name: 'Magnetic Clasp',
		measurement: 'count',
		unit: 'pieces',
		tracks_color: false,
		tracks_size: false,
	},
	{
		name: 'Rivet',
		measurement: 'count',
		unit: 'pieces',
		tracks_color: false,
		tracks_size: false,
	},
	{
		name: 'Key Ring',
		measurement: 'count',
		unit: 'pieces',
		tracks_color: false,
		tracks_size: false,
	},
];
