import { sql } from 'kysely';
import { db } from '../../../db/connection.js';
import { getStoreForUser } from '../../../utils/store.js';
import { startOfDayUtc } from '../../../utils/timezone.js';
import { netRevenueSum } from '../../../utils/revenue.js';
import { gateRows } from '../../../utils/report-gates.js';
import { productionItemFilter } from '../../../utils/production-filter.js';
import { OPERATIONS_MINIMUMS } from '../thresholds.js';
import type { OperationsData } from './contract/types.js';

export const VALID_RANGES = [30, 90, 365] as const;
export type OperationsRange = (typeof VALID_RANGES)[number];
export type OperationsBucket = 'day' | 'week' | 'month';

const CAPACITY_LOOKBACK_WEEKS = 8;

const bucketForRange = (range: OperationsRange): OperationsBucket => {
	if (range === 30) return 'day';
	if (range === 90) return 'week';
	return 'month';
};

const emptyDashboard = (range: OperationsRange): OperationsData => ({
	range,
	bucket: bucketForRange(range),
	revenue: { current: '0', previous: '0', changePercent: 0 },
	avgOrderValue: { current: '0', previous: '0', changePercent: 0 },
	ordersInProgress: 0,
	ordersCompletedInPeriod: 0,
	avgLeadTime: { days: null, target: null },
	capacity: { dueThisWeek: 0, typicalPerWeek: 0, peakPerWeek: 0 },
	dueSoon: [],
	ordersTrend: [],
});

async function getRevenue(
	storeId: string,
	periodStart: Date,
	previousPeriodStart: Date,
) {
	const currentPeriodFilter = sql`order_date >= ${periodStart}`;
	const previousPeriodFilter = sql`order_date >= ${previousPeriodStart} and order_date < ${periodStart}`;

	const row = await db
		.selectFrom('orders')
		.select([
			netRevenueSum(currentPeriodFilter).as('current_period'),
			netRevenueSum(previousPeriodFilter).as('previous_period'),
			sql<number>`count(*) filter (where ${currentPeriodFilter})`.as(
				'current_period_count',
			),
			sql<number>`count(*) filter (where ${previousPeriodFilter})`.as(
				'previous_period_count',
			),
		])
		.where('store_id', '=', storeId)
		.where('order_date', '>=', previousPeriodStart)
		.executeTakeFirstOrThrow();

	const currentRevenue = Number(row.current_period);
	const previousRevenue = Number(row.previous_period);
	const avgOrderValue =
		row.current_period_count > 0
			? currentRevenue / row.current_period_count
			: 0;
	const previousAvgOrderValue =
		row.previous_period_count > 0
			? previousRevenue / row.previous_period_count
			: 0;
	const avgOrderValueChangePercent =
		previousAvgOrderValue > 0
			? Math.round(
					((avgOrderValue - previousAvgOrderValue) / previousAvgOrderValue) *
						1000,
				) / 10
			: 0;
	const changePercent =
		previousRevenue > 0
			? Math.round(
					((currentRevenue - previousRevenue) / previousRevenue) * 1000,
				) / 10
			: 0;

	return {
		revenue: {
			current: row.current_period,
			previous: row.previous_period,
			changePercent,
		},
		avgOrderValue: {
			current: avgOrderValue.toFixed(2),
			previous: previousAvgOrderValue.toFixed(2),
			changePercent: avgOrderValueChangePercent,
		},
	};
}

async function getInProgress(storeId: string) {
	const row = await db
		.selectFrom('orders')
		.select(db.fn.count<number>('id').as('count'))
		.where('store_id', '=', storeId)
		.where('fulfillment_status', '=', 'pending')
		.executeTakeFirstOrThrow();
	return row.count;
}

async function getCompleted(storeId: string, periodStart: Date) {
	const row = await db
		.selectFrom('orders')
		.select(db.fn.count<number>('id').as('count'))
		.where('store_id', '=', storeId)
		.where('fulfilled_at', '>=', periodStart)
		.executeTakeFirstOrThrow();
	return row.count;
}

async function getAvgLeadTime(storeId: string, periodStart: Date) {
	const row = await db
		.selectFrom('orders')
		.select(
			sql<
				string | null
			>`avg(extract(epoch from (fulfilled_at - order_date)) / 86400)::text`.as(
				'avg_days',
			),
		)
		.where('store_id', '=', storeId)
		.where('fulfilled_at', 'is not', null)
		.where('fulfilled_at', '>=', periodStart)
		.executeTakeFirstOrThrow();

	return row.avg_days !== null
		? Math.round(Number(row.avg_days) * 10) / 10
		: null;
}

async function getDueSoon(storeId: string, todayUtc: number, dayMs: number) {
	const rows = await db
		// Per-order item totals and completed-item counts
		.with('item_counts', (qb) =>
			qb
				.selectFrom('order_items as oi')
				.innerJoin('orders as o', 'o.id', 'oi.order_id')
				.leftJoin(
					'order_item_workflow_stages as s',
					's.id',
					'oi.workflow_stage_id',
				)
				.select([
					'oi.order_id',
					sql<number>`count(*)`.as('total'),
					sql<number>`count(*) filter (where s.is_complete = true)`.as(
						'completed',
					),
				])
				.where('o.store_id', '=', storeId)
				.groupBy('oi.order_id'),
		)
		.selectFrom('orders')
		.leftJoin(
			'order_workflow_stages',
			'order_workflow_stages.id',
			'orders.workflow_stage_id',
		)
		.leftJoin('item_counts', 'item_counts.order_id', 'orders.id')
		.select([
			'orders.id',
			'orders.order_number',
			'orders.order_type',
			'orders.order_title',
			'orders.customer_name',
			'orders.order_date',
			'orders.due_date',
			'orders.grand_total',
			'order_workflow_stages.name as workflow_stage_name',
			'order_workflow_stages.color as workflow_stage_color',
			sql<number>`coalesce(item_counts.total, 0)`.as('item_count'),
			sql<number>`coalesce(item_counts.completed, 0)`.as('items_completed'),
		])
		.where('orders.store_id', '=', storeId)
		.where('orders.fulfillment_status', '=', 'pending')
		.where('orders.due_date', 'is not', null)
		.orderBy('orders.due_date', 'asc')
		.limit(5)
		.execute();

	return rows.map((row) => {
		const dueDate = row.due_date;
		let daysUntilDue: number | null = null;
		if (dueDate) {
			const [y, m, d] = dueDate.split('-').map(Number);
			const dueUtc = Date.UTC(y, m - 1, d);
			daysUntilDue = Math.round((dueUtc - todayUtc) / dayMs);
		}
		return {
			id: row.id,
			orderNumber: row.order_number,
			orderType: row.order_type,
			orderTitle: row.order_title,
			customerName: row.customer_name,
			orderDate: row.order_date,
			dueDate,
			daysUntilDue,
			grandTotal: row.grand_total,
			itemCount: row.item_count,
			itemsCompleted: row.items_completed,
			workflowStageName: row.workflow_stage_name,
			workflowStageColor: row.workflow_stage_color,
		};
	});
}

async function getOrdersTrend(
	storeId: string,
	periodStart: Date,
	bucket: OperationsBucket,
	timeZone: string,
) {
	const bucketLit = sql.lit(bucket);
	const tzLit = sql.lit(timeZone);

	const rows = await db
		.selectFrom('orders')
		.select([
			sql<string>`to_char(date_trunc(${bucketLit}, order_date AT TIME ZONE ${tzLit}), 'YYYY-MM-DD')`.as(
				'date',
			),
			sql<number>`count(*)`.as('count'),
			// sum on numeric stays as a string to preserve currency precision
			netRevenueSum().as('revenue'),
		])
		.where('store_id', '=', storeId)
		.where('order_date', '>=', periodStart)
		.groupBy(sql`date_trunc(${bucketLit}, order_date AT TIME ZONE ${tzLit})`)
		.orderBy('date', 'asc')
		.execute();

	const trend = rows.map((row) => {
		const revenue = Number(row.revenue);
		const aov = row.count > 0 ? revenue / row.count : 0;
		return {
			date: row.date,
			count: row.count,
			revenue: row.revenue,
			avgOrderValue: aov.toFixed(2),
		};
	});

	// Trend only needs enough points to read, no separate data gate
	return gateRows(trend, true, OPERATIONS_MINIMUMS.ordersTrend);
}

type CapacityRow = {
	due_this_week: number;
	typical_per_week: number | null;
	peak_per_week: number | null;
};

// Items due this week vs the maker's usual (avg) and peak (p90) weekly output
async function getCapacity(
	storeId: string,
	timeZone: string,
	weekStart: string,
	weekEnd: string,
) {
	const tzLit = sql.lit(timeZone);
	const minWeeks = OPERATIONS_MINIMUMS.capacityWeeks;
	const peakWeeks = OPERATIONS_MINIMUMS.capacityPeakWeeks;
	const result = await sql<CapacityRow>`
		WITH weekly AS (
			SELECT count(*) AS items
			FROM order_items oi
			INNER JOIN orders o ON o.id = oi.order_id
			LEFT JOIN product_variants pv ON pv.platform_sku = oi.platform_sku
				AND pv.product_id IN (SELECT id FROM products WHERE store_id = ${storeId})
			WHERE o.store_id = ${storeId}
				AND o.fulfilled_at IS NOT NULL
				AND o.fulfilled_at >= now() - interval '1 week' * ${CAPACITY_LOOKBACK_WEEKS}
				AND ${productionItemFilter('o', 'pv')}
			GROUP BY date_trunc('week', o.fulfilled_at AT TIME ZONE ${tzLit})
		)
		SELECT
			(
				SELECT count(*)
				FROM order_items oi
				INNER JOIN orders o ON o.id = oi.order_id
				LEFT JOIN product_variants pv ON pv.platform_sku = oi.platform_sku
					AND pv.product_id IN (SELECT id FROM products WHERE store_id = ${storeId})
				WHERE o.store_id = ${storeId}
					AND o.fulfillment_status = 'pending'
					AND o.due_date >= ${weekStart}
					AND o.due_date <= ${weekEnd}
					AND ${productionItemFilter('o', 'pv')}
			)::int AS due_this_week,
			(
				SELECT CASE WHEN count(*) >= ${minWeeks} THEN round(avg(items)) END
				FROM weekly
			)::int AS typical_per_week,
			(
				SELECT CASE
					WHEN count(*) >= ${peakWeeks}
					THEN round(percentile_cont(0.9) WITHIN GROUP (ORDER BY items))
				END
				FROM weekly
			)::int AS peak_per_week
	`.execute(db);

	const row = result.rows[0];
	return {
		dueThisWeek: row?.due_this_week ?? 0,
		typicalPerWeek: row?.typical_per_week ?? 0,
		peakPerWeek: row?.peak_per_week ?? 0,
	};
}

export async function getOperations(
	userId: string,
	range: OperationsRange,
): Promise<OperationsData> {
	const store = await getStoreForUser(userId);
	if (!store) return emptyDashboard(range);

	const bucket = bucketForRange(range);
	const now = new Date();
	const dayMs = 24 * 60 * 60 * 1000;
	const periodStart = new Date(now.getTime() - range * dayMs);
	const previousPeriodStart = new Date(now.getTime() - 2 * range * dayMs);

	const todayUtc = startOfDayUtc(now, store.timezone).getTime();
	const weekStart = new Date(todayUtc).toISOString().slice(0, 10);
	const weekEnd = new Date(todayUtc + 6 * dayMs).toISOString().slice(0, 10);

	const [
		revenue,
		ordersInProgress,
		ordersCompletedInPeriod,
		avgLeadTimeDays,
		dueSoon,
		ordersTrend,
		capacity,
	] = await Promise.all([
		getRevenue(store.id, periodStart, previousPeriodStart),
		getInProgress(store.id),
		getCompleted(store.id, periodStart),
		getAvgLeadTime(store.id, periodStart),
		getDueSoon(store.id, todayUtc, dayMs),
		getOrdersTrend(store.id, periodStart, bucket, store.timezone),
		getCapacity(store.id, store.timezone, weekStart, weekEnd),
	]);

	return {
		range,
		bucket,
		revenue: revenue.revenue,
		avgOrderValue: revenue.avgOrderValue,
		ordersInProgress,
		ordersCompletedInPeriod,
		avgLeadTime: {
			days: avgLeadTimeDays,
			target: store.lead_time_days,
		},
		capacity,
		dueSoon,
		ordersTrend,
	};
}
