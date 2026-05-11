import { sql } from 'kysely';
import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';

export const VALID_RANGES = [30, 90, 365] as const;
export type DashboardRange = (typeof VALID_RANGES)[number];
export type DashboardBucket = 'day' | 'week' | 'month';

const bucketForRange = (range: DashboardRange): DashboardBucket => {
	if (range === 30) return 'day';
	if (range === 90) return 'week';
	return 'month';
};

export type DashboardData = {
	range: DashboardRange;
	bucket: DashboardBucket;
	revenue: {
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
	}>;
	ordersTrend: Array<{
		date: string;
		count: number;
		revenue: string;
	}>;
};

const emptyDashboard = (range: DashboardRange): DashboardData => ({
	range,
	bucket: bucketForRange(range),
	revenue: { current: '0', previous: '0', changePercent: 0 },
	ordersInProgress: 0,
	ordersCompletedInPeriod: 0,
	avgLeadTime: { days: null, target: null },
	dueSoon: [],
	ordersTrend: [],
});

export async function getDashboard(
	userId: string,
	range: DashboardRange,
): Promise<DashboardData> {
	const store = await getStoreForUser(userId);
	if (!store) return emptyDashboard(range);

	const bucket = bucketForRange(range);
	const now = new Date();
	const dayMs = 24 * 60 * 60 * 1000;
	const periodStart = new Date(now.getTime() - range * dayMs);
	const previousPeriodStart = new Date(now.getTime() - 2 * range * dayMs);

	const revenue = await db
		.selectFrom('orders')
		.select([
			sql<string>`coalesce(sum(grand_total) filter (where order_date >= ${periodStart}), 0)::text`.as(
				'current_period',
			),
			sql<string>`coalesce(sum(grand_total) filter (where order_date >= ${previousPeriodStart} and order_date < ${periodStart}), 0)::text`.as(
				'previous_period',
			),
		])
		.where('store_id', '=', store.id)
		.where('order_date', '>=', previousPeriodStart)
		.executeTakeFirstOrThrow();

	const currentRevenue = Number(revenue.current_period);
	const previousRevenue = Number(revenue.previous_period);
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
		.selectFrom('orders')
		.select([
			'id',
			'order_number',
			'customer_name',
			'order_date',
			'due_date',
			'grand_total',
		])
		.where('store_id', '=', store.id)
		.where('fulfillment_status', '=', 'pending')
		.where('due_date', 'is not', null)
		.orderBy('due_date', 'asc')
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
		};
	});

	const bucketLit = sql.lit(bucket);
	const ordersTrendRaw = await db
		.selectFrom('orders')
		.select([
			sql<string>`to_char(date_trunc(${bucketLit}, order_date), 'YYYY-MM-DD')`.as(
				'date',
			),
			sql<string>`count(*)::text`.as('count'),
			sql<string>`coalesce(sum(grand_total), 0)::text`.as('revenue'),
		])
		.where('store_id', '=', store.id)
		.where('order_date', '>=', periodStart)
		.groupBy(sql`date_trunc(${bucketLit}, order_date)`)
		.orderBy('date', 'asc')
		.execute();

	const ordersTrend = ordersTrendRaw.map((row) => ({
		date: row.date,
		count: Number(row.count),
		revenue: row.revenue,
	}));

	return {
		range,
		bucket,
		revenue: {
			current: revenue.current_period,
			previous: revenue.previous_period,
			changePercent,
		},
		ordersInProgress: Number(inProgress.count),
		ordersCompletedInPeriod: Number(completed.count),
		avgLeadTime: {
			days: avgLeadTimeDays,
			target: store.lead_time_days,
		},
		dueSoon,
		ordersTrend,
	};
}
