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
	// AVG of EXTRACT(EPOCH ...) returns numeric, stays as string
	avg_seconds: string;
	transition_count: number;
};

type TopProductRow = {
	product_name: string;
	total_units: number;
	total_revenue: string;
	order_count: number;
};

async function getTopProducts(storeId: string, rangeDays: number) {
	const rows = await sql<TopProductRow>`
		SELECT
			oi.product_name,
			SUM(oi.quantity) AS total_units,
			SUM(oi.quantity * COALESCE(oi.unit_price::numeric, 0))::text AS total_revenue,
			COUNT(DISTINCT oi.order_id) AS order_count
		FROM order_items oi
		INNER JOIN orders o ON o.id = oi.order_id
		WHERE o.store_id = ${storeId}
			AND o.order_date >= NOW() - INTERVAL '1 day' * ${rangeDays}
		GROUP BY oi.product_name
		ORDER BY SUM(oi.quantity * COALESCE(oi.unit_price::numeric, 0)) DESC
		LIMIT 5
	`.execute(db);

	const products = rows.rows.map((row) => ({
		productName: row.product_name,
		totalUnits: row.total_units,
		totalRevenue: Number(row.total_revenue),
		orderCount: row.order_count,
	}));

	return { products };
}

type CustomerMixRow = {
	current_new: number;
	current_returning: number;
	current_total: number;
	prior_new: number;
	prior_returning: number;
	prior_total: number;
};

async function getCustomerMix(storeId: string, rangeDays: number) {
	const rows = await sql<CustomerMixRow>`
		WITH customer_first_order AS (
			SELECT
				customer_email,
				MIN(order_date) AS first_order_date
			FROM orders
			WHERE store_id = ${storeId}
				AND customer_email IS NOT NULL
			GROUP BY customer_email
		),
		current_customers AS (
			SELECT DISTINCT customer_email
			FROM orders
			WHERE store_id = ${storeId}
				AND order_date >= NOW() - INTERVAL '1 day' * ${rangeDays}
				AND customer_email IS NOT NULL
		),
		current_repeat AS (
			SELECT DISTINCT o.customer_email
			FROM orders o
			INNER JOIN customer_first_order cfo USING (customer_email)
			WHERE o.store_id = ${storeId}
				AND o.order_date >= NOW() - INTERVAL '1 day' * ${rangeDays}
				AND o.order_date > cfo.first_order_date
				AND o.customer_email IS NOT NULL
		),
		prior_customers AS (
			SELECT DISTINCT customer_email
			FROM orders
			WHERE store_id = ${storeId}
				AND order_date >= NOW() - INTERVAL '1 day' * ${rangeDays * 2}
				AND order_date < NOW() - INTERVAL '1 day' * ${rangeDays}
				AND customer_email IS NOT NULL
		),
		prior_repeat AS (
			SELECT DISTINCT o.customer_email
			FROM orders o
			INNER JOIN customer_first_order cfo USING (customer_email)
			WHERE o.store_id = ${storeId}
				AND o.order_date >= NOW() - INTERVAL '1 day' * ${rangeDays * 2}
				AND o.order_date < NOW() - INTERVAL '1 day' * ${rangeDays}
				AND o.order_date > cfo.first_order_date
				AND o.customer_email IS NOT NULL
		)
		SELECT
			(SELECT COUNT(*) FROM current_repeat) AS current_returning,
			((SELECT COUNT(*) FROM current_customers) - (SELECT COUNT(*) FROM current_repeat)) AS current_new,
			(SELECT COUNT(*) FROM current_customers) AS current_total,
			(SELECT COUNT(*) FROM prior_repeat) AS prior_returning,
			((SELECT COUNT(*) FROM prior_customers) - (SELECT COUNT(*) FROM prior_repeat)) AS prior_new,
			(SELECT COUNT(*) FROM prior_customers) AS prior_total
	`.execute(db);

	const row = rows.rows[0];
	return {
		newCount: row?.current_new ?? 0,
		returningCount: row?.current_returning ?? 0,
		totalCount: row?.current_total ?? 0,
		priorNewCount: row?.prior_new ?? 0,
		priorReturningCount: row?.prior_returning ?? 0,
		priorTotalCount: row?.prior_total ?? 0,
	};
}

type CouponUsageRow = {
	current_with_promo: number;
	current_total: number;
	// avg of numeric stays as string to preserve currency precision
	avg_discount: string | null;
	prior_with_promo: number;
	prior_total: number;
};

async function getCouponUsage(storeId: string, rangeDays: number) {
	const rows = await sql<CouponUsageRow>`
		SELECT
			COUNT(*) FILTER (
				WHERE order_date >= NOW() - INTERVAL '1 day' * ${rangeDays}
					AND promo_code IS NOT NULL
			) AS current_with_promo,
			COUNT(*) FILTER (
				WHERE order_date >= NOW() - INTERVAL '1 day' * ${rangeDays}
			) AS current_total,
			AVG(discount_total::numeric) FILTER (
				WHERE order_date >= NOW() - INTERVAL '1 day' * ${rangeDays}
					AND promo_code IS NOT NULL
			)::text AS avg_discount,
			COUNT(*) FILTER (
				WHERE order_date >= NOW() - INTERVAL '1 day' * ${rangeDays * 2}
					AND order_date < NOW() - INTERVAL '1 day' * ${rangeDays}
					AND promo_code IS NOT NULL
			) AS prior_with_promo,
			COUNT(*) FILTER (
				WHERE order_date >= NOW() - INTERVAL '1 day' * ${rangeDays * 2}
					AND order_date < NOW() - INTERVAL '1 day' * ${rangeDays}
			) AS prior_total
		FROM orders
		WHERE store_id = ${storeId}
	`.execute(db);

	const row = rows.rows[0];
	const withPromoCount = row?.current_with_promo ?? 0;
	const totalCount = row?.current_total ?? 0;
	const priorWithPromoCount = row?.prior_with_promo ?? 0;
	const priorTotalCount = row?.prior_total ?? 0;

	return {
		withPromoCount,
		noPromoCount: totalCount - withPromoCount,
		totalCount,
		avgDiscount: row?.avg_discount ? Number(row.avg_discount) : 0,
		priorWithPromoCount,
		priorNoPromoCount: priorTotalCount - priorWithPromoCount,
		priorTotalCount,
	};
}

type MaterialConsumptionRow = {
	material_type: string;
	color: string | null;
	measurement: 'linear' | 'area' | 'count';
	current_qty: string;
	prior_qty: string;
};

async function getMaterialConsumption(storeId: string, rangeDays: number) {
	const rows = await sql<MaterialConsumptionRow>`
		WITH consumption AS (
			SELECT
				bmt.id AS material_type_id,
				bmt.name AS material_type,
				m.color,
				b.measurement,
				SUM(
					CASE
						WHEN b.measurement = 'linear'
							THEN COALESCE(b.length::numeric, 0) * b.quantity * oi.quantity
						ELSE b.quantity * oi.quantity
					END
				) FILTER (
					WHERE o.order_date >= NOW() - INTERVAL '1 day' * ${rangeDays}
				) AS current_qty,
				SUM(
					CASE
						WHEN b.measurement = 'linear'
							THEN COALESCE(b.length::numeric, 0) * b.quantity * oi.quantity
						ELSE b.quantity * oi.quantity
					END
				) FILTER (
					WHERE o.order_date >= NOW() - INTERVAL '1 day' * ${rangeDays * 2}
						AND o.order_date < NOW() - INTERVAL '1 day' * ${rangeDays}
				) AS prior_qty
			FROM order_items oi
			INNER JOIN orders o ON o.id = oi.order_id
			INNER JOIN bom_items b ON b.platform_sku = oi.platform_sku AND b.store_id = ${storeId}
			INNER JOIN materials m ON m.id = b.material_id
			INNER JOIN bom_material_types bmt ON bmt.id = m.material_type_id
			WHERE o.store_id = ${storeId}
				AND o.order_date >= NOW() - INTERVAL '1 day' * ${rangeDays * 2}
			GROUP BY bmt.id, bmt.name, m.color, b.measurement
		)
		SELECT
			material_type,
			color,
			measurement,
			COALESCE(current_qty, 0)::text AS current_qty,
			COALESCE(prior_qty, 0)::text AS prior_qty
		FROM consumption
		WHERE current_qty > 0
			AND prior_qty > 0
			AND current_qty != prior_qty
		ORDER BY (current_qty - prior_qty) / (prior_qty + 1) DESC
		LIMIT 5
	`.execute(db);

	const materials = rows.rows.map((row) => ({
		materialType: row.material_type,
		color: row.color,
		measurement: row.measurement,
		currentQty: Number(row.current_qty),
		priorQty: Number(row.prior_qty),
	}));

	return { materials };
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
			COUNT(*) AS transition_count
		FROM transitions t
		INNER JOIN order_workflow_stages s ON s.id = t.to_stage_id
		WHERE t.next_transition_at IS NOT NULL
			AND t.transitioned_at >= NOW() - INTERVAL '1 day' * ${rangeDays}
			AND s.is_complete = false
		GROUP BY s.id, s.name, s.color, s.position
		ORDER BY s.position ASC
	`.execute(db);

	const stages = rows.rows.map((row) => ({
		stageId: row.stage_id,
		stageName: row.stage_name,
		stageColor: row.stage_color,
		avgDays: Number(row.avg_seconds) / 86400,
		transitionCount: row.transition_count,
	}));

	return { stages };
}

export async function getPerformance(userId: string, input: PerformanceInput) {
	const store = await getStoreForUser(userId);
	if (!store) {
		return {
			stageBottleneck: { stages: [] },
			topProducts: { products: [] },
			customerMix: {
				newCount: 0,
				returningCount: 0,
				totalCount: 0,
				priorNewCount: 0,
				priorReturningCount: 0,
				priorTotalCount: 0,
			},
			couponUsage: {
				withPromoCount: 0,
				noPromoCount: 0,
				totalCount: 0,
				avgDiscount: 0,
				priorWithPromoCount: 0,
				priorNoPromoCount: 0,
				priorTotalCount: 0,
			},
			materialConsumption: { materials: [] },
		};
	}

	const rangeDays = Number(input.range);

	const [
		stageBottleneck,
		topProducts,
		customerMix,
		couponUsage,
		materialConsumption,
	] = await Promise.all([
		getStageBottleneck(store.id, rangeDays),
		getTopProducts(store.id, rangeDays),
		getCustomerMix(store.id, rangeDays),
		getCouponUsage(store.id, rangeDays),
		getMaterialConsumption(store.id, rangeDays),
	]);

	return {
		stageBottleneck,
		topProducts,
		customerMix,
		couponUsage,
		materialConsumption,
	};
}
