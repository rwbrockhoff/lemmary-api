import pg from 'pg';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { faker } from '@faker-js/faker';
import { env } from '../../config/environment.js';
import type { Database } from '../database-types.js';
import { TEST_USER_ID, TEST_STORE_ID } from '../../tests/test-constants.js';
import {
	ORDER_STAGES,
	ITEM_STAGES,
	STAGE_HOURS,
	PRODUCTS,
	MATERIAL_TYPES,
	MATERIALS,
	BOM_ITEMS,
} from './data/test/mock-data.js';

const PROMO_CODES = ['SUMMER25', 'WELCOME10', 'FRIEND50'];
const CUSTOMER_POOL_SIZE = 8;
const ORDER_COUNT = 15;
const RETURNING_CUSTOMER_RATE = 0.3;
const PROMO_RATE = 0.25;
const FULFILLED_RATE = 0.6;

const daysAgo = (n: number) => {
	const d = new Date();
	d.setUTCHours(12, 0, 0, 0); // stable noon UTC so ::date casts can't flip the day
	d.setDate(d.getDate() - n);
	return d;
};

async function seedTest() {
	faker.seed(42);

	const db = new Kysely<Database>({
		dialect: new PostgresDialect({
			pool: new pg.Pool({ connectionString: env.DATABASE_URL }),
		}),
	});

	console.log('Seeding test data...');

	await db
		.insertInto('users')
		.values({
			id: TEST_USER_ID,
			email: 'test@lemmary.test',
			first_name: 'Test',
			last_name: 'User',
		})
		.execute();

	const encryptedToken = sql<Buffer>`pgp_sym_encrypt('test-key', ${env.STORE_ENCRYPTION_KEY})`;
	await db
		.insertInto('stores')
		.values({
			id: TEST_STORE_ID,
			user_id: TEST_USER_ID,
			platform: 'squarespace',
			store_name: 'Test Store',
			store_access_token: encryptedToken,
			lead_time_days: 14,
			platform_config: {
				base_url: 'https://api.squarespace.com/1.0',
				api_version: '1.0',
			},
		})
		.execute();

	const insertedOrderStages = await db
		.insertInto('order_workflow_stages')
		.values(ORDER_STAGES.map((s) => ({ ...s, store_id: TEST_STORE_ID })))
		.returning(['id', 'name'])
		.execute();
	const stageByName = new Map(insertedOrderStages.map((s) => [s.name, s.id]));

	const insertedItemStages = await db
		.insertInto('order_item_workflow_stages')
		.values(ITEM_STAGES.map((s) => ({ ...s, store_id: TEST_STORE_ID })))
		.returning(['id', 'name'])
		.execute();
	const itemStageByName = new Map(
		insertedItemStages.map((s) => [s.name, s.id]),
	);

	const insertedMaterialTypes = await db
		.insertInto('bom_material_types')
		.values(
			MATERIAL_TYPES.map((t, i) => ({
				...t,
				store_id: TEST_STORE_ID,
				position: i,
			})),
		)
		.returning(['id', 'name'])
		.execute();
	const materialTypeByName = new Map(
		insertedMaterialTypes.map((t) => [t.name, t.id]),
	);

	const materialKey = (type: string, color: string) => `${type}|${color}`;
	const insertedMaterials = await db
		.insertInto('materials')
		.values(
			MATERIALS.map((m) => ({
				store_id: TEST_STORE_ID,
				material_type_id: materialTypeByName.get(m.type)!,
				color: m.color,
				size: null,
			})),
		)
		.returning(['id', 'color', 'material_type_id'])
		.execute();
	const materialByKey = new Map(
		insertedMaterials.map((m) => {
			const typeName = MATERIAL_TYPES.find(
				(t) => materialTypeByName.get(t.name) === m.material_type_id,
			)!.name;
			return [materialKey(typeName, m.color!), m.id];
		}),
	);

	let bomPosition = 0;
	for (const bom of BOM_ITEMS) {
		const matType = MATERIAL_TYPES.find((t) => t.name === bom.materialType)!;
		await db
			.insertInto('bom_items')
			.values({
				store_id: TEST_STORE_ID,
				material_id: materialByKey.get(
					materialKey(bom.materialType, bom.color),
				)!,
				measurement: matType.measurement,
				platform_sku: bom.sku,
				product_name: PRODUCTS.find((p) => p.sku === bom.sku)!.name,
				variant: 'Default',
				piece: bom.piece,
				length: bom.length?.toString() ?? null,
				quantity: bom.quantity,
				position: bomPosition++ * 1000,
			})
			.execute();
	}

	const customerPool = Array.from({ length: CUSTOMER_POOL_SIZE }, () => ({
		name: faker.person.fullName(),
		email: faker.internet.email().toLowerCase(),
	}));

	const stageNames = ORDER_STAGES.map((s) => s.name);
	const finishedItemStageId = itemStageByName.get('Finished')!;
	const notStartedItemStageId = itemStageByName.get('Not Started')!;

	for (let i = 0; i < ORDER_COUNT; i++) {
		const fulfilled = faker.number.float() < FULFILLED_RATE;
		const dayOffset = faker.number.int({ min: 1, max: 60 });
		const orderDate = daysAgo(dayOffset);
		const dueDate = daysAgo(dayOffset - 14);
		const fulfilledOn = fulfilled ? daysAgo(Math.max(0, dayOffset - 8)) : null;
		const currentStageName = fulfilled
			? 'Finished'
			: stageNames[faker.number.int({ min: 0, max: stageNames.length - 2 })];

		const isReturning = i > 2 && faker.number.float() < RETURNING_CUSTOMER_RATE;
		const customer = isReturning
			? customerPool[faker.number.int({ min: 0, max: 2 })]
			: customerPool[
					faker.number.int({ min: 0, max: customerPool.length - 1 })
				];

		const product =
			PRODUCTS[faker.number.int({ min: 0, max: PRODUCTS.length - 1 })];
		const quantity = faker.number.int({ min: 1, max: 3 });
		const subtotal = product.price * quantity;
		const hasPromo = faker.number.float() < PROMO_RATE;
		const discount = hasPromo ? faker.number.int({ min: 5, max: 25 }) : 0;
		const grandTotal = subtotal + 12 - discount;

		const order = await db
			.insertInto('orders')
			.values({
				store_id: TEST_STORE_ID,
				platform_order_id: `test-${1000 + i}`,
				order_number: `T-${String(1000 + i).padStart(4, '0')}`,
				customer_name: customer.name,
				customer_email: customer.email,
				order_date: orderDate,
				fulfillment_status: fulfilled ? 'fulfilled' : 'pending',
				due_date: dueDate.toISOString().slice(0, 10),
				workflow_stage_id: stageByName.get(currentStageName) ?? null,
				subtotal: subtotal.toString(),
				shipping_total: '12.00',
				grand_total: grandTotal.toString(),
				currency: 'USD',
				fulfilled_at: fulfilledOn,
				promo_code: hasPromo ? PROMO_CODES[i % PROMO_CODES.length] : null,
				discount_total: discount.toString(),
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		await db
			.insertInto('order_items')
			.values({
				order_id: order.id,
				platform_line_item_id: `${order.id}-1`,
				platform_sku: product.sku,
				product_name: product.name,
				variant_label: sql`${JSON.stringify([])}::jsonb`,
				quantity,
				unit_price: product.price.toString(),
				workflow_stage_id: fulfilled
					? finishedItemStageId
					: notStartedItemStageId,
			})
			.execute();

		const currentStageIdx = stageNames.indexOf(currentStageName);
		let elapsedMs = 0;
		let previousStageId: string | null = null;
		for (let s = 0; s <= currentStageIdx; s++) {
			const stageName = stageNames[s];
			const toStageId = stageByName.get(stageName)!;
			const transitionedAt = new Date(orderDate.getTime() + elapsedMs);
			await db
				.insertInto('order_stage_history')
				.values({
					order_id: order.id,
					from_stage_id: previousStageId,
					to_stage_id: toStageId,
					transitioned_at: transitionedAt,
				})
				.execute();
			previousStageId = toStageId;
			const [minHrs, maxHrs] = STAGE_HOURS[stageName] ?? [4, 12];
			elapsedMs +=
				faker.number.int({ min: minHrs, max: maxHrs }) * 60 * 60 * 1000;
		}
	}

	await db.destroy();
	console.log(`Test seed complete: ${ORDER_COUNT} orders`);
}

seedTest();
