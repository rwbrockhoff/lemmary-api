import { describe, it, expect } from 'vitest';
import { sql } from 'kysely';
import { db } from '../db/connection.js';
import { netRevenueSum } from './revenue.js';
import { TEST_STORE_ID } from '../tests/test-constants.js';

const platformIdFilter = sql`platform_order_id like 'rev-test-%'`;

describe('netRevenueSum', () => {
	// Each test inserts rows inside a transaction and throws an error at the
	// end to force a rollback, so nothing leaks into other test files
	it('sums subtotal minus discount across matching rows', async () => {
		const ROLLBACK = new Error('__rollback_test_tx__');

		await db
			.transaction()
			.execute(async (trx) => {
				await trx
					.insertInto('orders')
					.values([
						{
							store_id: TEST_STORE_ID,
							platform_order_id: 'rev-test-1',
							order_number: 'RT-1',
							customer_name: 'Pam Beesly',
							order_date: new Date(),
							subtotal: '100',
							discount_total: '10',
						},
						{
							store_id: TEST_STORE_ID,
							platform_order_id: 'rev-test-2',
							order_number: 'RT-2',
							customer_name: 'Michael Scott',
							order_date: new Date(),
							subtotal: '50',
							discount_total: '0',
						},
					])
					.execute();

				const result = await trx
					.selectFrom('orders')
					.select(netRevenueSum(platformIdFilter).as('total'))
					.where('store_id', '=', TEST_STORE_ID)
					.executeTakeFirstOrThrow();

				// (100 - 10) + (50 - 0) = 140
				expect(Number(result.total)).toBe(140);

				throw ROLLBACK;
			})
			.catch((err) => {
				if (err !== ROLLBACK) throw err;
			});
	});

	it('treats a missing discount as zero', async () => {
		const ROLLBACK = new Error('__rollback_test_tx__');

		await db
			.transaction()
			.execute(async (trx) => {
				await trx
					.insertInto('orders')
					.values({
						store_id: TEST_STORE_ID,
						platform_order_id: 'rev-test-1',
						order_number: 'RT-1',
						customer_name: 'Jim Halpert',
						order_date: new Date(),
						subtotal: '75',
					})
					.execute();

				const result = await trx
					.selectFrom('orders')
					.select(netRevenueSum(platformIdFilter).as('total'))
					.where('store_id', '=', TEST_STORE_ID)
					.executeTakeFirstOrThrow();

				expect(Number(result.total)).toBe(75);

				throw ROLLBACK;
			})
			.catch((err) => {
				if (err !== ROLLBACK) throw err;
			});
	});

	it('returns zero when no rows match (rather than null)', async () => {
		const result = await db
			.selectFrom('orders')
			.select(
				netRevenueSum(sql`platform_order_id = 'never-matches'`).as('total'),
			)
			.where('store_id', '=', TEST_STORE_ID)
			.executeTakeFirstOrThrow();

		expect(Number(result.total)).toBe(0);
	});

	it('scopes the sum to a period when a date filter is passed', async () => {
		const ROLLBACK = new Error('__rollback_test_tx__');
		const today = new Date();
		const lastYear = new Date(today);
		lastYear.setFullYear(lastYear.getFullYear() - 1);

		await db
			.transaction()
			.execute(async (trx) => {
				await trx
					.insertInto('orders')
					.values([
						{
							store_id: TEST_STORE_ID,
							platform_order_id: 'rev-test-recent',
							order_number: 'RT-1',
							customer_name: 'Dwight Schrute',
							order_date: today,
							subtotal: '200',
						},
						{
							store_id: TEST_STORE_ID,
							platform_order_id: 'rev-test-old',
							order_number: 'RT-2',
							customer_name: 'Dwight Schrute',
							order_date: lastYear,
							subtotal: '500',
						},
					])
					.execute();

				const periodStart = new Date(today);
				periodStart.setMonth(periodStart.getMonth() - 1);

				const result = await trx
					.selectFrom('orders')
					.select(
						netRevenueSum(
							sql`${platformIdFilter} and order_date >= ${periodStart}`,
						).as('total'),
					)
					.where('store_id', '=', TEST_STORE_ID)
					.executeTakeFirstOrThrow();

				// only the recent row falls inside the last-month window
				expect(Number(result.total)).toBe(200);

				throw ROLLBACK;
			})
			.catch((err) => {
				if (err !== ROLLBACK) throw err;
			});
	});
});
