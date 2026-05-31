import { sql } from 'kysely';
import { db } from '../../../db/connection.js';
import { getStoreForUser } from '../../../utils/store.js';
import { netRevenueSum } from '../../../utils/revenue.js';

export const VALID_RANGES = [30, 90, 365] as const;
export type OperationsRange = (typeof VALID_RANGES)[number];
export type OperationsBucket = 'day' | 'week' | 'month';

const bucketForRange = (range: OperationsRange): OperationsBucket => {
	if (range === 30) return 'day';
	if (range === 90) return 'week';
	return 'month';
};

export type OperationsData = {
	range: OperationsRange;
	bucket: OperationsBucket;
	revenue: {
		current: string;
		previous: string;
		changePercent: number;
	};
	avgOrderValue: {
		current: string;
		previous: string;
		changePercent: number;
	};
	ordersInProgress: number;
	ordersCompletedInPeriod: number;
	avgLeadTime: {
		days: number | null;
		target: number | null;
	};
	dueSoon: Array<{
		id: string;
		orderNumber: string;
		customerName: string;
		orderDate: Date;
		dueDate: Date | null;
		daysUntilDue: number | null;
		grandTotal: string | null;
		itemCount: number;
		itemsCompleted: number;
		workflowStageName: string | null;
		workflowStageColor: string | null;
	}>;
	ordersTrend: Array<{
		date: string;
		count: number;
		revenue: string;
		avgOrderValue: string;
	}>;
};

const emptyDashboard = (range: OperationsRange): OperationsData => ({
	range,
	bucket: bucketForRange(range),
	revenue: { current: '0', previous: '0', changePercent: 0 },
	avgOrderValue: { current: '0', previous: '0', changePercent: 0 },
	ordersInProgress: 0,
	ordersCompletedInPeriod: 0,
	avgLeadTime: { days: null, target: null },
	dueSoon: [],
	ordersTrend: [],
});

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

	const currentPeriodFilter = sql`order_date >= ${periodStart}`;
	const previousPeriodFilter = sql`order_date >= ${previousPeriodStart} and order_date < ${periodStart}`;

	const revenue = await db
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
		.where('store_id', '=', store.id)
		.where('order_date', '>=', previousPeriodStart)
		.executeTakeFirstOrThrow();

	const currentRevenue = Number(revenue.current_period);
	const previousRevenue = Number(revenue.previous_period);
	const currentPeriodOrderCount = revenue.current_period_count;
	const previousPeriodOrderCount = revenue.previous_period_count;
	const avgOrderValue =
		currentPeriodOrderCount > 0 ? currentRevenue / currentPeriodOrderCount : 0;
	const previousAvgOrderValue =
		previousPeriodOrderCount > 0
			? previousRevenue / previousPeriodOrderCount
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

	const inProgress = await db
		.selectFrom('orders')
		.select(db.fn.count<number>('id').as('count'))
		.where('store_id', '=', store.id)
		.where('fulfillment_status', '=', 'pending')
		.executeTakeFirstOrThrow();

	const completed = await db
		.selectFrom('orders')
		.select(db.fn.count<number>('id').as('count'))
		.where('store_id', '=', store.id)
		.where('fulfilled_on', '>=', periodStart)
		.executeTakeFirstOrThrow();

	const leadTime = await db
		.selectFrom('orders')
		.select(
			sql<
				string | null
			>`avg(extract(epoch from (fulfilled_on - order_date)) / 86400)::text`.as(
				'avg_days',
			),
		)
		.where('store_id', '=', store.id)
		.where('fulfilled_on', 'is not', null)
		.where('fulfilled_on', '>=', periodStart)
		.executeTakeFirstOrThrow();

	const avgLeadTimeDays =
		leadTime.avg_days !== null
			? Math.round(Number(leadTime.avg_days) * 10) / 10
			: null;

	const dueSoonRaw = await db
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
				.where('o.store_id', '=', store.id)
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
			'orders.customer_name',
			'orders.order_date',
			'orders.due_date',
			'orders.grand_total',
			'order_workflow_stages.name as workflow_stage_name',
			'order_workflow_stages.color as workflow_stage_color',
			sql<number>`coalesce(item_counts.total, 0)`.as('item_count'),
			sql<number>`coalesce(item_counts.completed, 0)`.as('items_completed'),
		])
		.where('orders.store_id', '=', store.id)
		.where('orders.fulfillment_status', '=', 'pending')
		.where('orders.due_date', 'is not', null)
		.orderBy('orders.due_date', 'asc')
		.limit(5)
		.execute();

	const dueSoon = dueSoonRaw.map((row) => {
		const dueDate = row.due_date;
		const daysUntilDue = dueDate
			? Math.ceil((dueDate.getTime() - now.getTime()) / dayMs)
			: null;
		return {
			id: row.id,
			orderNumber: row.order_number,
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

	const bucketLit = sql.lit(bucket);
	const ordersTrendRaw = await db
		.selectFrom('orders')
		.select([
			sql<string>`to_char(date_trunc(${bucketLit}, order_date), 'YYYY-MM-DD')`.as(
				'date',
			),
			sql<number>`count(*)`.as('count'),
			// sum on numeric stays as a string to preserve currency precision
			netRevenueSum().as('revenue'),
		])
		.where('store_id', '=', store.id)
		.where('order_date', '>=', periodStart)
		.groupBy(sql`date_trunc(${bucketLit}, order_date)`)
		.orderBy('date', 'asc')
		.execute();

	const ordersTrend = ordersTrendRaw.map((row) => {
		const revenue = Number(row.revenue);
		const aov = row.count > 0 ? revenue / row.count : 0;
		return {
			date: row.date,
			count: row.count,
			revenue: row.revenue,
			avgOrderValue: aov.toFixed(2),
		};
	});

	return {
		range,
		bucket,
		revenue: {
			current: revenue.current_period,
			previous: revenue.previous_period,
			changePercent,
		},
		avgOrderValue: {
			current: avgOrderValue.toFixed(2),
			previous: previousAvgOrderValue.toFixed(2),
			changePercent: avgOrderValueChangePercent,
		},
		ordersInProgress: inProgress.count,
		ordersCompletedInPeriod: completed.count,
		avgLeadTime: {
			days: avgLeadTimeDays,
			target: store.lead_time_days,
		},
		dueSoon,
		ordersTrend,
	};
}
