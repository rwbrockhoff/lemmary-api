import 'dotenv/config';
import pg from 'pg';
import { Kysely, PostgresDialect, sql } from 'kysely';
import type { Database } from '../database-types.js';
import { DEMO_USER_ID, DEMO_STORE_ID } from '../../config/constants.js';
import { DEMO_PRODUCTS } from './data/demo/demo-products.js';
import { DEMO_CUSTOMERS } from './data/demo/demo-customers.js';
import {
	DEMO_ORDER_STAGES,
	DEMO_ITEM_STAGES,
} from './data/demo/demo-workflow.js';
import { DEMO_MATERIAL_TYPES } from './data/demo/demo-material-types.js';
import { DEMO_ORDERS } from './data/demo/demo-orders.js';
import { DEMO_BATCHES } from './data/demo/demo-batches.js';
import { buildOrderStageHistory } from './data/demo/demo-stage-history.js';
import { populateBatchData } from '../../utils/batch-aggregation.js';

const daysAgo = (n: number) => {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d;
};

async function seedDemo() {
	const db = new Kysely<Database>({
		dialect: new PostgresDialect({
			pool: new pg.Pool({ connectionString: process.env.DATABASE_URL }),
		}),
	});

	console.log('Seeding demo data (Twelve Stitch)...');

	await db
		.insertInto('users')
		.values({
			id: DEMO_USER_ID,
			email: 'demo@twelvestitch.com',
			first_name: 'Twelve',
			last_name: 'Stitch',
		})
		.onConflict((oc) =>
			oc.column('id').doUpdateSet({
				email: 'demo@twelvestitch.com',
				first_name: 'Twelve',
				last_name: 'Stitch',
			}),
		)
		.execute();

	const encryptedToken = sql<Buffer>`pgp_sym_encrypt('demo-key-not-used', ${process.env.STORE_ENCRYPTION_KEY})`;

	const platformConfig = {
		base_url: 'https://api.squarespace.com/1.0',
		api_version: '1.0',
	};

	await db
		.insertInto('stores')
		.values({
			id: DEMO_STORE_ID,
			user_id: DEMO_USER_ID,
			platform: 'squarespace',
			store_name: 'Twelve Stitch',
			store_access_token: encryptedToken,
			lead_time_days: 14,
			platform_config: platformConfig,
		})
		.onConflict((oc) =>
			oc
				.column('id')
				.doUpdateSet({ store_name: 'Twelve Stitch', lead_time_days: 14 }),
		)
		.execute();

	const batchesQuery = db
		.selectFrom('production_batches')
		.select('id')
		.where('store_id', '=', DEMO_STORE_ID);
	await db
		.deleteFrom('production_batch_materials')
		.where('batch_id', 'in', batchesQuery)
		.execute();
	await db
		.deleteFrom('production_batch_order_items')
		.where('batch_id', 'in', batchesQuery)
		.execute();
	await db
		.deleteFrom('production_batch_items')
		.where('batch_id', 'in', batchesQuery)
		.execute();
	await db
		.deleteFrom('production_batch_orders')
		.where('batch_id', 'in', batchesQuery)
		.execute();
	await db
		.deleteFrom('production_batches')
		.where('store_id', '=', DEMO_STORE_ID)
		.execute();

	const ordersQuery = db
		.selectFrom('orders')
		.select('id')
		.where('store_id', '=', DEMO_STORE_ID);
	await db
		.deleteFrom('order_items')
		.where('order_id', 'in', ordersQuery)
		.execute();
	await db.deleteFrom('orders').where('store_id', '=', DEMO_STORE_ID).execute();

	const productsQuery = db
		.selectFrom('products')
		.select('id')
		.where('store_id', '=', DEMO_STORE_ID);
	await db
		.deleteFrom('product_variants')
		.where('product_id', 'in', productsQuery)
		.execute();
	await db
		.deleteFrom('products')
		.where('store_id', '=', DEMO_STORE_ID)
		.execute();

	await db
		.deleteFrom('bom_items')
		.where('store_id', '=', DEMO_STORE_ID)
		.execute();
	await db
		.deleteFrom('materials')
		.where('store_id', '=', DEMO_STORE_ID)
		.execute();
	await db
		.deleteFrom('bom_material_types')
		.where('store_id', '=', DEMO_STORE_ID)
		.execute();
	await db
		.deleteFrom('order_workflow_stages')
		.where('store_id', '=', DEMO_STORE_ID)
		.execute();
	await db
		.deleteFrom('order_item_workflow_stages')
		.where('store_id', '=', DEMO_STORE_ID)
		.execute();

	const insertedOrderStages = await db
		.insertInto('order_workflow_stages')
		.values(DEMO_ORDER_STAGES.map((s) => ({ ...s, store_id: DEMO_STORE_ID })))
		.returning(['id', 'name'])
		.execute();
	const stageByName = new Map(insertedOrderStages.map((s) => [s.name, s.id]));

	const insertedItemStages = await db
		.insertInto('order_item_workflow_stages')
		.values(DEMO_ITEM_STAGES.map((s) => ({ ...s, store_id: DEMO_STORE_ID })))
		.returning(['id', 'name'])
		.execute();
	const itemStageByName = new Map(
		insertedItemStages.map((s) => [s.name, s.id]),
	);
	console.log('  Workflow stages seeded');

	const insertedTypes = await db
		.insertInto('bom_material_types')
		.values(
			DEMO_MATERIAL_TYPES.map((t, i) => ({
				...t,
				store_id: DEMO_STORE_ID,
				position: i,
			})),
		)
		.returning(['id', 'name'])
		.execute();
	const typeByName = new Map(insertedTypes.map((t) => [t.name, t.id]));

	const materialCache = new Map<string, string>();
	async function getOrCreateMaterial(
		typeName: string,
		color: string | null,
		size: string | null,
	) {
		const key = `${typeName}|${color ?? ''}|${size ?? ''}`;
		const cached = materialCache.get(key);
		if (cached) return cached;
		const typeId = typeByName.get(typeName);
		if (!typeId) throw new Error(`Unknown material type: ${typeName}`);
		const m = await db
			.insertInto('materials')
			.values({
				store_id: DEMO_STORE_ID,
				material_type_id: typeId,
				color,
				size,
			})
			.returning('id')
			.executeTakeFirstOrThrow();
		materialCache.set(key, m.id);
		return m.id;
	}

	const variantBySku = new Map<
		string,
		{ name: string; price: number; productName: string }
	>();
	let bomPosition = 0;
	for (const product of DEMO_PRODUCTS) {
		const inserted = await db
			.insertInto('products')
			.values({
				store_id: DEMO_STORE_ID,
				platform_product_id: product.platformProductId,
				name: product.name,
				slug: product.slug,
				is_visible: true,
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		for (const variant of product.variants) {
			variantBySku.set(variant.platformSku, {
				name: variant.name,
				price: variant.price,
				productName: product.name,
			});
			await db
				.insertInto('product_variants')
				.values({
					product_id: inserted.id,
					platform_variant_id: variant.platformVariantId,
					platform_sku: variant.platformSku,
					name: variant.name,
					price: variant.price.toString(),
				})
				.execute();

			for (const piece of product.bom) {
				const colorForPiece =
					piece.materialType === 'Full-Grain Leather'
						? variant.color
						: piece.materialType === 'Lining Fabric'
							? variant.color
							: null;
				const materialId = await getOrCreateMaterial(
					piece.materialType,
					colorForPiece,
					piece.size,
				);
				await db
					.insertInto('bom_items')
					.values({
						store_id: DEMO_STORE_ID,
						material_id: materialId,
						measurement: piece.measurement,
						platform_sku: variant.platformSku,
						product_name: product.name,
						variant: variant.name,
						piece: piece.piece,
						length: piece.length?.toString() ?? null,
						quantity: piece.quantity,
						position: bomPosition++ * 1000,
					})
					.execute();
			}
		}
	}
	console.log(
		`  Products: ${DEMO_PRODUCTS.length} (${variantBySku.size} variants)`,
	);

	const insertedOrders: Array<{
		id: string;
		dayOffset: number;
		fulfilled: boolean;
	}> = [];
	const stageHistoryRows: Array<{
		order_id: string;
		from_stage_id: string | null;
		to_stage_id: string;
		transitioned_at: Date;
	}> = [];
	const finishedItemStageId = itemStageByName.get('Finished') ?? null;
	const notStartedItemStageId = itemStageByName.get('Not Started') ?? null;
	const seedNow = new Date();

	for (let i = 0; i < DEMO_ORDERS.length; i++) {
		const spec = DEMO_ORDERS[i];
		const orderDate = daysAgo(spec.dayOffset);
		const dueDate = new Date(orderDate);
		dueDate.setDate(dueDate.getDate() + 14);
		const customerName =
			DEMO_CUSTOMERS[spec.customerIndex % DEMO_CUSTOMERS.length];
		const orderNumber = `TS-${String(1000 + i).padStart(4, '0')}`;
		const stageId = stageByName.get(spec.stageName) ?? null;
		const fulfilledOn = spec.fulfilled
			? daysAgo(spec.fulfilledDayOffset ?? Math.max(0, spec.dayOffset - 8))
			: null;

		const orderTotal = spec.items.reduce((sum, item) => {
			const variant = variantBySku.get(item.platformSku);
			return sum + (variant ? variant.price * item.quantity : 0);
		}, 0);
		const discountTotal = spec.discountTotal ?? 0;
		const grandTotal = orderTotal + 12 - discountTotal;

		const order = await db
			.insertInto('orders')
			.values({
				store_id: DEMO_STORE_ID,
				platform_order_id: `sq-${orderNumber}`,
				order_number: orderNumber,
				customer_name: customerName,
				customer_email: `${customerName.toLowerCase().replace(/\s/g, '.')}@example.com`,
				order_date: orderDate,
				fulfillment_status: spec.fulfilled ? 'fulfilled' : 'pending',
				due_date: dueDate.toISOString().slice(0, 10),
				workflow_stage_id: stageId,
				subtotal: orderTotal.toString(),
				shipping_total: '12.00',
				grand_total: grandTotal.toString(),
				currency: 'USD',
				fulfilled_at: fulfilledOn,
				promo_code: spec.promoCode ?? null,
				discount_total: discountTotal.toString(),
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		insertedOrders.push({
			id: order.id,
			dayOffset: spec.dayOffset,
			fulfilled: spec.fulfilled,
		});

		const transitions = buildOrderStageHistory({
			orderIdx: i,
			orderDate,
			currentStageName: spec.stageName,
			fulfilled: spec.fulfilled,
			fulfilledOn,
			now: seedNow,
		});
		for (const t of transitions) {
			const toId = stageByName.get(t.toStage);
			if (!toId) continue;
			stageHistoryRows.push({
				order_id: order.id,
				from_stage_id: stageByName.get(t.fromStage) ?? null,
				to_stage_id: toId,
				transitioned_at: t.at,
			});
		}

		for (let j = 0; j < spec.items.length; j++) {
			const item = spec.items[j];
			const variant = variantBySku.get(item.platformSku);
			if (!variant) continue;
			await db
				.insertInto('order_items')
				.values({
					order_id: order.id,
					platform_line_item_id: `${orderNumber}-${j}`,
					platform_sku: item.platformSku,
					product_name: variant.productName,
					variant_label: sql`${JSON.stringify([{ name: 'Variant', value: variant.name }])}::jsonb`,
					quantity: item.quantity,
					unit_price: variant.price.toString(),
					workflow_stage_id: spec.fulfilled
						? finishedItemStageId
						: item.itemStageName
							? (itemStageByName.get(item.itemStageName) ??
								notStartedItemStageId)
							: notStartedItemStageId,
				})
				.execute();
		}
	}
	console.log(`  Orders: ${insertedOrders.length}`);

	if (stageHistoryRows.length > 0) {
		await db
			.insertInto('order_stage_history')
			.values(stageHistoryRows)
			.execute();
	}
	console.log(`  Stage history: ${stageHistoryRows.length} transitions`);

	for (const batch of DEMO_BATCHES) {
		const insertedBatch = await db
			.insertInto('production_batches')
			.values({
				store_id: DEMO_STORE_ID,
				name: batch.name,
				status: batch.status,
				completed_at:
					batch.completedDayOffset !== null
						? daysAgo(batch.completedDayOffset)
						: null,
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		const matchingOrders = insertedOrders.filter(
			(o) =>
				o.dayOffset >= batch.assignByDayRange.minDays &&
				o.dayOffset <= batch.assignByDayRange.maxDays &&
				o.fulfilled === batch.assignByDayRange.fulfilled,
		);

		if (matchingOrders.length === 0) continue;

		const matchingOrderIds = matchingOrders.map((o) => o.id);
		const allFulfilled = batch.assignByDayRange.fulfilled;

		await db.transaction().execute(async (trx) => {
			await populateBatchData(
				trx,
				insertedBatch.id,
				matchingOrderIds,
				DEMO_STORE_ID,
			);

			if (allFulfilled) {
				await trx
					.updateTable('production_batch_orders')
					.set({ completed: true })
					.where('batch_id', '=', insertedBatch.id)
					.execute();

				await trx
					.updateTable('production_batch_order_items')
					.set({ completed: true, completed_qty: sql`quantity` })
					.where('batch_id', '=', insertedBatch.id)
					.execute();

				await trx
					.updateTable('production_batch_items')
					.set({ completed: true })
					.where('batch_id', '=', insertedBatch.id)
					.execute();

				await trx
					.updateTable('production_batch_materials')
					.set({ completed: true })
					.where('batch_id', '=', insertedBatch.id)
					.execute();
			}
		});
	}
	console.log(`  Batches: ${DEMO_BATCHES.length}`);

	await db.destroy();
	console.log('Demo seed complete');
}

seedDemo().catch((err) => {
	// Exit non-zero so Railway marks the cron run as failed
	console.error(err);
	process.exit(1);
});
