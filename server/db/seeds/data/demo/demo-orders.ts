import { faker } from '@faker-js/faker';
import { DEMO_CUSTOMERS } from './demo-customers.js';

export type DemoOrderItem = {
	platformSku: string;
	quantity: number;
	itemStageName?: string;
};

export type DemoOrderSpec = {
	dayOffset: number;
	customerIndex: number;
	stageName: string;
	fulfilled: boolean;
	fulfilledDayOffset?: number;
	items: DemoOrderItem[];
	promoCode?: string;
	discountTotal?: number;
	orderType?: 'custom' | 'work';
	orderTitle?: string;
	orderNumber?: string;
};

const ORDER_COUNT = 140;
const MAX_DAY_OFFSET = 180;
const LEAD_TIME_DAYS = 14;
const MIN_DAYS_UNTIL_DUE = 2;
const PENDING_ORDER_RATE = 0.1;
const RETURNING_CUSTOMER_RATE = 0.08;

const SKUS = [
	'TS-CRO-TAN',
	'TS-CRO-BLK',
	'TS-WAL-BLK',
	'TS-WAL-COG',
	'TS-WAL-TAN',
	'TS-FOB-BLK',
	'TS-FOB-COG',
	'TS-FOB-NVY',
	'TS-FOB-TAN',
	'TS-CRD-BLK',
	'TS-CRD-BUR',
	'TS-CRD-COG',
	'TS-CRD-TAN',
	'TS-TOT-BLK',
	'TS-TOT-TAN',
];

const PENDING_STAGE_WEIGHTS = [
	{ weight: 4, value: 'New' },
	{ weight: 3, value: 'Cutting' },
	{ weight: 2, value: 'Stitching' },
	{ weight: 1, value: 'Edge Finishing' },
];

const ITEM_STAGE_FOR: Record<string, string> = {
	New: 'Not Started',
	Cutting: 'Cut',
	Stitching: 'Stitched',
	'Edge Finishing': 'Stitched',
};

const PROMO_CODES = ['LAUNCH20', 'WELCOME10', 'SUMMER15', 'FIRSTORDER'];

function generateOrder(
	customerIndex: number,
	isPending: boolean,
): DemoOrderSpec {
	let dayOffset: number;
	let stageName: string;
	let itemStageName: string;
	let fulfilledDayOffset: number | undefined;

	if (isPending) {
		dayOffset = faker.number.int({
			min: 1,
			max: LEAD_TIME_DAYS - MIN_DAYS_UNTIL_DUE,
		});
		stageName = faker.helpers.weightedArrayElement(PENDING_STAGE_WEIGHTS);
		itemStageName = ITEM_STAGE_FOR[stageName];
	} else {
		dayOffset = faker.number.int({ min: LEAD_TIME_DAYS, max: MAX_DAY_OFFSET });
		stageName = 'Shipped';
		itemStageName = 'Finished';
		fulfilledDayOffset = Math.max(
			1,
			dayOffset - faker.number.int({ min: 6, max: 12 }),
		);
	}

	const itemCount = faker.number.int({ min: 1, max: 3 });
	const orderSkus = faker.helpers.arrayElements(SKUS, itemCount);
	const items: DemoOrderItem[] = orderSkus.map((sku) => ({
		platformSku: sku,
		quantity: faker.number.int({ min: 1, max: 2 }),
		itemStageName,
	}));

	const hasPromo = faker.number.float({ min: 0, max: 1 }) < 0.25;

	return {
		dayOffset,
		customerIndex,
		stageName,
		fulfilled: !isPending,
		fulfilledDayOffset,
		items,
		promoCode: hasPromo ? faker.helpers.arrayElement(PROMO_CODES) : undefined,
		discountTotal: hasPromo
			? faker.number.float({ min: 5, max: 20, fractionDigits: 2 })
			: undefined,
	};
}

function generateDemoOrders(): DemoOrderSpec[] {
	faker.seed(42);
	const seenCustomers: number[] = [];
	let nextCustomerIdx = 0;

	const orders = Array.from({ length: ORDER_COUNT }, () => {
		const isReturning =
			seenCustomers.length > 0 &&
			faker.number.float({ min: 0, max: 1 }) < RETURNING_CUSTOMER_RATE;

		let customerIndex: number;
		if (isReturning) {
			customerIndex = faker.helpers.arrayElement(seenCustomers);
		} else {
			customerIndex = nextCustomerIdx % DEMO_CUSTOMERS.length;
			seenCustomers.push(customerIndex);
			nextCustomerIdx++;
		}

		const isPending =
			faker.number.float({ min: 0, max: 1 }) < PENDING_ORDER_RATE;
		return generateOrder(customerIndex, isPending);
	});

	return orders.sort((a, b) => b.dayOffset - a.dayOffset);
}

// A work order and two custom orders so the demo shows the non-platform order
// types. C-1 reuses an existing customer for a mixed order history.
const MANUAL_DEMO_ORDERS: DemoOrderSpec[] = [
	{
		orderType: 'work',
		orderNumber: 'WO-1',
		orderTitle: 'Backstock build — bestsellers',
		dayOffset: 5,
		customerIndex: 0,
		stageName: 'Cutting',
		fulfilled: false,
		items: [
			{ platformSku: 'TS-CRO-TAN', quantity: 6 },
			{ platformSku: 'TS-WAL-BLK', quantity: 4 },
		],
	},
	{
		orderType: 'custom',
		orderNumber: 'C-1',
		dayOffset: 8,
		customerIndex: 0,
		stageName: 'Stitching',
		fulfilled: false,
		items: [{ platformSku: 'TS-TOT-BLK', quantity: 2 }],
	},
	{
		orderType: 'custom',
		orderNumber: 'C-2',
		dayOffset: 3,
		customerIndex: 4,
		stageName: 'New',
		fulfilled: false,
		items: [{ platformSku: 'TS-FOB-COG', quantity: 1 }],
	},
];

export const DEMO_ORDERS: DemoOrderSpec[] = [
	...generateDemoOrders(),
	...MANUAL_DEMO_ORDERS,
];
