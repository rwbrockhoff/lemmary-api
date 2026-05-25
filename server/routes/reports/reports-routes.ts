import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	ProductionSummaryResponseSchema,
	MaterialsReportResponseSchema,
} from './contract/schemas.js';
import {
	handleProductionSummary,
	handleMaterialsReport,
} from './reports-controller.js';

export async function reportsRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/reports/production-summary',
		{
			schema: {
				tags: [ApiTags.REPORTS],
				summary: 'Production summary — pending order quantities by SKU',
				response: {
					200: successSchema(ProductionSummaryResponseSchema),
				},
			},
		},
		handleProductionSummary,
	);

	r.get(
		'/reports/materials',
		{
			schema: {
				tags: [ApiTags.REPORTS],
				summary: 'Materials report — fabric, linear, hardware, and BOM mismatches',
				response: {
					200: successSchema(MaterialsReportResponseSchema),
				},
			},
		},
		handleMaterialsReport,
	);
}
