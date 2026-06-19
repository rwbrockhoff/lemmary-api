export type DevWorkflowStage = {
	name: string;
	position: number;
	color: string;
	is_default: boolean;
	is_complete: boolean;
};

export const DEV_ORDER_STAGES: DevWorkflowStage[] = [
	{
		name: 'New',
		position: 0,
		color: 'slate',
		is_default: true,
		is_complete: false,
	},
	{
		name: 'In Progress 🔄',
		position: 1,
		color: 'cobalt',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Order Finished 🙌🏻',
		position: 2,
		color: 'lavender',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Ready to Ship 📦',
		position: 3,
		color: 'lavender',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Fulfilled 👏🏻',
		position: 4,
		color: 'pine',
		is_default: false,
		is_complete: true,
	},
];

export const DEV_ITEM_STAGES: DevWorkflowStage[] = [
	{
		name: 'Not Started',
		position: 0,
		color: 'slate',
		is_default: true,
		is_complete: false,
	},
	{
		name: 'Fabric Cut ✂️',
		position: 1,
		color: 'cobalt',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Components Ready 📎',
		position: 2,
		color: 'cobalt',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'In Progress 🔄',
		position: 3,
		color: 'lavender',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Done 👏🏻',
		position: 4,
		color: 'pine',
		is_default: false,
		is_complete: true,
	},
];
