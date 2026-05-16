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

type CustomerMixRow = {
	current_new: string;
	current_returning: string;
	current_total: string;
	prior_new: string;
	prior_returning: string;
	prior_total: string;
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
				AND order_date >= NOW() - (${rangeDays} || ' days')::interval
				AND customer_email IS NOT NULL
		),
		current_repeat AS (
			SELECT DISTINCT o.customer_email
			FROM orders o
			INNER JOIN customer_first_order cfo USING (customer_email)
			WHERE o.store_id = ${storeId}
				AND o.order_date >= NOW() - (${rangeDays} || ' days')::interval
				AND o.order_date > cfo.first_order_date
				AND o.customer_email IS NOT NULL
		),
		prior_customers AS (
			SELECT DISTINCT customer_email
			FROM orders
			WHERE store_id = ${storeId}
				AND order_date >= NOW() - (${rangeDays * 2} || ' days')::interval
				AND order_date < NOW() - (${rangeDays} || ' days')::interval
				AND customer_email IS NOT NULL
		),
		prior_repeat AS (
			SELECT DISTINCT o.customer_email
			FROM orders o
			INNER JOIN customer_first_order cfo USING (customer_email)
			WHERE o.store_id = ${storeId}
				AND o.order_date >= NOW() - (${rangeDays * 2} || ' days')::interval
				AND o.order_date < NOW() - (${rangeDays} || ' days')::interval
				AND o.order_date > cfo.first_order_date
				AND o.customer_email IS NOT NULL
		)
		SELECT
			(SELECT COUNT(*) FROM current_repeat)::text AS current_returning,
			((SELECT COUNT(*) FROM current_customers) - (SELECT COUNT(*) FROM current_repeat))::text AS current_new,
			(SELECT COUNT(*) FROM current_customers)::text AS current_total,
			(SELECT COUNT(*) FROM prior_repeat)::text AS prior_returning,
			((SELECT COUNT(*) FROM prior_customers) - (SELECT COUNT(*) FROM prior_repeat))::text AS prior_new,
			(SELECT COUNT(*) FROM prior_customers)::text AS prior_total
	`.execute(db);

	const row = rows.rows[0];
	return {
		newCount: Number(row?.current_new ?? 0),
		returningCount: Number(row?.current_returning ?? 0),
		totalCount: Number(row?.current_total ?? 0),
		priorNewCount: Number(row?.prior_new ?? 0),
		priorReturningCount: Number(row?.prior_returning ?? 0),
		priorTotalCount: Number(row?.prior_total ?? 0),
	};
}

type CouponUsageRow = {
	current_with_promo: string;
	current_total: string;
	avg_discount: string | null;
	prior_with_promo: string;
	prior_total: string;
};

async function getCouponUsage(storeId: string, rangeDays: number) {
	const rows = await sql<CouponUsageRow>`
		SELECT
			COUNT(*) FILTER (
				WHERE order_date >= NOW() - (${rangeDays} || ' days')::interval
					AND promo_code IS NOT NULL
			)::text AS current_with_promo,
			COUNT(*) FILTER (
				WHERE order_date >= NOW() - (${rangeDays} || ' days')::interval
			)::text AS current_total,
			AVG(discount_total::numeric) FILTER (
				WHERE order_date >= NOW() - (${rangeDays} || ' days')::interval
					AND promo_code IS NOT NULL
			)::text AS avg_discount,
			COUNT(*) FILTER (
				WHERE order_date >= NOW() - (${rangeDays * 2} || ' days')::interval
					AND order_date < NOW() - (${rangeDays} || ' days')::interval
					AND promo_code IS NOT NULL
			)::text AS prior_with_promo,
			COUNT(*) FILTER (
				WHERE order_date >= NOW() - (${rangeDays * 2} || ' days')::interval
					AND order_date < NOW() - (${rangeDays} || ' days')::interval
			)::text AS prior_total
		FROM orders
		WHERE store_id = ${storeId}
	`.execute(db);

	const row = rows.rows[0];
	const withPromoCount = Number(row?.current_with_promo ?? 0);
	const totalCount = Number(row?.current_total ?? 0);
	const priorWithPromoCount = Number(row?.prior_with_promo ?? 0);
	const priorTotalCount = Number(row?.prior_total ?? 0);

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
		};
	}

	const rangeDays = Number(input.range);

	const [stageBottleneck, topProducts, customerMix, couponUsage] =
		await Promise.all([
			getStageBottleneck(store.id, rangeDays),
			getTopProducts(store.id, rangeDays),
			getCustomerMix(store.id, rangeDays),
			getCouponUsage(store.id, rangeDays),
		]);

	return { stageBottleneck, topProducts, customerMix, couponUsage };
}
