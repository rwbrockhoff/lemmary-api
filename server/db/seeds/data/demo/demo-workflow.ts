export type DemoWorkflowStage = {
	name: string;
	position: number;
	color: string;
	is_default: boolean;
	is_complete: boolean;
};

export const DEMO_ORDER_STAGES: DemoWorkflowStage[] = [
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
		name: 'Edge Finishing',
		position: 3,
		color: 'lavender',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Quality Check',
		position: 4,
		color: 'marigold',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Shipped',
		position: 5,
		color: 'pine',
		is_default: false,
		is_complete: true,
	},
];

export const DEMO_ITEM_STAGES: DemoWorkflowStage[] = [
	{
		name: 'Not Started',
		position: 0,
		color: 'slate',
		is_default: true,
		is_complete: false,
	},
	{
		name: 'Cut',
		position: 1,
		color: 'clay',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Stitched',
		position: 2,
		color: 'cobalt',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Finished',
		position: 3,
		color: 'pine',
		is_default: false,
		is_complete: true,
	},
];
