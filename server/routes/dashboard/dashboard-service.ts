import { sql } from 'kysely';
import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';

export type DashboardData = {
	thisMonthRevenue: {
		current: string;
		previousMonth: string;
		changePercent: number;
	};
	ordersInProgress: number;
	ordersCompletedThisMonth: number;
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
	ordersByDay: Array<{
		date: string;
		count: number;
		revenue: string;
	}>;
};

const EMPTY_DASHBOARD: DashboardData = {
	thisMonthRevenue: { current: '0', previousMonth: '0', changePercent: 0 },
	ordersInProgress: 0,
	ordersCompletedThisMonth: 0,
	avgLeadTime: { days: null, target: null },
	dueSoon: [],
	ordersByDay: [],
};

export async function getDashboard(userId: string): Promise<DashboardData> {
	const store = await getStoreForUser(userId);
	if (!store) return EMPTY_DASHBOARD;

	const revenue = await db
		.selectFrom('orders')
		.select([
			sql<string>`coalesce(sum(grand_total) filter (where order_date >= date_trunc('month', now())), 0)::text`.as(
				'current_month',
			),
			sql<string>`coalesce(sum(grand_total) filter (where order_date >= date_trunc('month', now()) - interval '1 month' and order_date < date_trunc('month', now())), 0)::text`.as(
				'previous_month',
			),
		])
		.where('store_id', '=', store.id)
		.where(
			'order_date',
			'>=',
			sql<Date>`date_trunc('month', now()) - interval '1 month'`,
		)
		.executeTakeFirstOrThrow();

	const currentRevenue = Number(revenue.current_month);
	const previousRevenue = Number(revenue.previous_month);
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
		.where('fulfilled_on', '>=', sql<Date>`date_trunc('month', now())`)
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

	const now = new Date();
	const dueSoon = dueSoonRaw.map((row) => {
		const dueDate = row.due_date;
		const daysUntilDue = dueDate
			? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
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

	const ordersByDayRaw = await db
		.selectFrom('orders')
		.select([
			sql<string>`to_char(date_trunc('day', order_date), 'YYYY-MM-DD')`.as(
				'date',
			),
			sql<string>`count(*)::text`.as('count'),
			sql<string>`coalesce(sum(grand_total), 0)::text`.as('revenue'),
		])
		.where('store_id', '=', store.id)
		.where('order_date', '>=', sql<Date>`now() - interval '30 days'`)
		.groupBy(sql`date_trunc('day', order_date)`)
		.orderBy('date', 'asc')
		.execute();

	const ordersByDay = ordersByDayRaw.map((row) => ({
		date: row.date,
		count: Number(row.count),
		revenue: row.revenue,
	}));

	return {
		thisMonthRevenue: {
			current: revenue.current_month,
			previousMonth: revenue.previous_month,
			changePercent,
		},
		ordersInProgress: Number(inProgress.count),
		ordersCompletedThisMonth: Number(completed.count),
		avgLeadTime: {
			days: avgLeadTimeDays,
			target: store.lead_time_days,
		},
		dueSoon,
		ordersByDay,
	};
}
