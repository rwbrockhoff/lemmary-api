import type { WorkflowStageColor } from './workflow-stage-colors.js';

type DefaultStage = {
	name: string;
	position: number;
	color: WorkflowStageColor;
	is_default: boolean;
	is_complete: boolean;
};

export const DEFAULT_ORDER_STAGES: DefaultStage[] = [
	{
		name: 'New',
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
		name: 'Ready to Ship',
		position: 2,
		color: 'marigold',
		is_default: false,
		is_complete: false,
	},
	{
		name: 'Fulfilled',
		position: 3,
		color: 'pine',
		is_default: false,
		is_complete: true,
	},
];

export const DEFAULT_ITEM_STAGES: DefaultStage[] = [
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
		name: 'Done',
		position: 2,
		color: 'pine',
		is_default: false,
		is_complete: true,
	},
];
