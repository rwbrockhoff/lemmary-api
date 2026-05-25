import { ApiTags } from './tags.js';
import { REFRESH_TOKEN_COOKIE } from '../config/constants.js';
import { env } from '../config/environment.js';

export const openApiMetadata = {
	info: {
		title: 'Lemmary API',
		version: '1.0.0',
		description:
			'REST API for Lemmary — production management and reporting for makers. Syncs orders from connected e-commerce platforms, cross-references a bill of materials, and generates production and materials reports.',
	},
	servers: [
		{ url: `http://localhost:${env.PORT}`, description: 'Development server' },
		{ url: 'https://api.lemmary.com', description: 'Production server' },
	],
	tags: [
		{
			name: ApiTags.AUTH,
			description: 'Authentication and session management',
		},
		{
			name: ApiTags.ORDERS,
			description: 'Order syncing and workflow management',
		},
		{
			name: ApiTags.BATCHES,
			description: 'Production batch grouping and management',
		},
		{ name: ApiTags.BOM, description: 'Bill of materials and material types' },
		{ name: ApiTags.PRODUCTS, description: 'Products and variants' },
		{ name: ApiTags.REPORTS, description: 'Production and materials reports' },
		{
			name: ApiTags.ANALYTICS,
			description: 'Performance and operations analytics',
		},
		{ name: ApiTags.SETTINGS, description: 'Account and store settings' },
		{
			name: ApiTags.STORE,
			description: 'Store connection and platform configuration',
		},
		{
			name: ApiTags.WORKFLOW_STAGES,
			description: 'Customizable production workflow stages',
		},
	],
	components: {
		securitySchemes: {
			cookieAuth: {
				type: 'apiKey' as const,
				in: 'cookie' as const,
				name: REFRESH_TOKEN_COOKIE,
			},
		},
	},
	security: [{ cookieAuth: [] }],
};
