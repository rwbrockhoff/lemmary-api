import { sql } from 'kysely';
import { z } from 'zod';
import { db } from '../../../db/connection.js';
import { getStoreForUser } from '../../../utils/store.js';
import type { PerformanceQuerySchema } from './contract/schemas.js';

type PerformanceInput = z.infer<typeof PerformanceQuerySchema>;

type StageBottleneckRow = {
	stage_id: string;
	stage_name: string;
	stage_color: string | null;
	avg_seconds: string;
	transition_count: string;
};

type TopProductRow = {
	product_name: string;
	total_units: string;
	total_revenue: string;
	order_count: string;
};

async function getTopProducts(storeId: string, rangeDays: number) {
	const rows = await sql<TopProductRow>`
		SELECT
			oi.product_name,
			SUM(oi.quantity)::text AS total_units,
			SUM(oi.quantity * COALESCE(oi.unit_price::numeric, 0))::text AS total_revenue,
			COUNT(DISTINCT oi.order_id)::text AS order_count
		FROM order_items oi
		INNER JOIN orders o ON o.id = oi.order_id
		WHERE o.store_id = ${storeId}
			AND o.order_date >= NOW() - (${rangeDays} || ' days')::interval
		GROUP BY oi.product_name
		ORDER BY SUM(oi.quantity * COALESCE(oi.unit_price::numeric, 0)) DESC
		LIMIT 5
	`.execute(db);

	const products = rows.rows.map((row) => ({
		productName: row.product_name,
		totalUnits: Number(row.total_units),
		totalRevenue: Number(row.total_revenue),
		orderCount: Number(row.order_count),
	}));

	return { products };
}

async function getStageBottleneck(storeId: string, rangeDays: number) {
	const rows = await sql<StageBottleneckRow>`
		WITH transitions AS (
			SELECT
				h.to_stage_id,
				h.transitioned_at,
				LEAD(h.transitioned_at) OVER (
					PARTITION BY h.order_id
					ORDER BY h.transitioned_at
				) AS next_transition_at
			FROM order_stage_history h
			INNER JOIN orders o ON o.id = h.order_id
			WHERE o.store_id = ${storeId}
		)
		SELECT
			s.id AS stage_id,
			s.name AS stage_name,
			s.color AS stage_color,
			AVG(EXTRACT(EPOCH FROM (t.next_transition_at - t.transitioned_at)))::text AS avg_seconds,
			COUNT(*)::text AS transition_count
		FROM transitions t
		INNER JOIN order_workflow_stages s ON s.id = t.to_stage_id
		WHERE t.next_transition_at IS NOT NULL
			AND t.transitioned_at >= NOW() - (${rangeDays} || ' days')::interval
		GROUP BY s.id, s.name, s.color, s.position
		ORDER BY s.position ASC
	`.execute(db);

	const stages = rows.rows.map((row) => ({
		stageId: row.stage_id,
		stageName: row.stage_name,
		stageColor: row.stage_color,
		avgDays: Number(row.avg_seconds) / 86400,
		transitionCount: Number(row.transition_count),
	}));

	return { stages };
}

export async function getPerformance(userId: string, input: PerformanceInput) {
	const store = await getStoreForUser(userId);
	if (!store) {
		return {
			stageBottleneck: { stages: [] },
			topProducts: { products: [] },
		};
	}

	const rangeDays = Number(input.range);

	const [stageBottleneck, topProducts] = await Promise.all([
		getStageBottleneck(store.id, rangeDays),
		getTopProducts(store.id, rangeDays),
	]);

	return { stageBottleneck, topProducts };
}
