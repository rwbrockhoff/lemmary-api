export const WORKFLOW_STAGE_COLORS = [
	'slate',
	'pine',
	'cobalt',
	'marigold',
	'coral',
	'lavender',
	'clay',
	'sage',
] as const;

export type WorkflowStageColor = (typeof WORKFLOW_STAGE_COLORS)[number];
