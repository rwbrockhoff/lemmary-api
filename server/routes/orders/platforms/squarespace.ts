import type { NewOrder, NewOrderItem } from '../../../db/database-types.js';
import { applyOrNull } from '../../../utils/nullable.js';

const BASE_URL = 'https://api.squarespace.com/1.0/commerce/orders';

type SquarespaceMoneyValue = {
	value: string;
	currency: string;
};

type SquarespaceAddress = {
	firstName: string;
	lastName: string;
};

type SquarespaceVariantOption = {
	value: string;
	optionName: string;
};

type SquarespaceLineItem = {
	id: string;
	sku: string;
	productName: string;
	quantity: number;
	unitPricePaid: SquarespaceMoneyValue;
	variantOptions: SquarespaceVariantOption[];
	imageUrl: string;
};

type SquarespaceInternalNote = {
	content: string;
};

type SquarespaceShippingLine = {
	method: string;
};

type SquarespaceFulfillment = {
	trackingNumber: string | null;
	trackingUrl: string | null;
	carrierName: string | null;
};

type SquarespaceDiscountLine = {
	name: string;
	description: string;
	amount: SquarespaceMoneyValue;
	promoCode: string | null;
};

type SquarespaceOrder = {
	id: string;
	orderNumber: string;
	createdOn: string;
	customerEmail: string;
	shippingAddress: SquarespaceAddress;
	fulfillmentStatus: string;
	subtotal: SquarespaceMoneyValue;
	shippingTotal: SquarespaceMoneyValue;
	grandTotal: SquarespaceMoneyValue;
	fulfilledOn: string | null;
	lineItems: SquarespaceLineItem[];
	internalNotes: SquarespaceInternalNote[];
	shippingLines: SquarespaceShippingLine[];
	fulfillments: SquarespaceFulfillment[];
	discountTotal: SquarespaceMoneyValue;
	discountLines: SquarespaceDiscountLine[];
};

type SquarespaceResponse = {
	result: SquarespaceOrder[];
	pagination: {
		hasNextPage: boolean;
		nextPageCursor: string | null;
		nextPageUrl: string | null;
	};
};

export type NormalizedOrder = {
	order: Omit<NewOrder, 'store_id'>;
	items: Omit<NewOrderItem, 'order_id'>[];
};

async function fetchPage(
	apiKey: string,
	params?: {
		fulfillmentStatus?: string;
		cursor?: string;
		modifiedAfter?: string;
		modifiedBefore?: string;
	},
): Promise<SquarespaceResponse> {
	const searchParams = new URLSearchParams();

	if (params?.cursor) {
		searchParams.set('cursor', params.cursor);
	} else {
		if (params?.fulfillmentStatus) {
			searchParams.set('fulfillmentStatus', params.fulfillmentStatus);
		}
		if (params?.modifiedAfter) {
			searchParams.set('modifiedAfter', params.modifiedAfter);
			searchParams.set(
				'modifiedBefore',
				params.modifiedBefore ?? new Date().toISOString(),
			);
		}
	}

	const query = searchParams.toString();
	const url = query ? `${BASE_URL}?${query}` : BASE_URL;

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Squarespace API error ${response.status}: ${text}`);
	}

	return response.json() as Promise<SquarespaceResponse>;
}

function normalizeOrder(raw: SquarespaceOrder): NormalizedOrder {
	const firstName = raw.shippingAddress?.firstName ?? '';
	const lastName = raw.shippingAddress?.lastName ?? '';
	const customerName = [firstName, lastName].filter(Boolean).join(' ');

	const order: Omit<NewOrder, 'store_id'> = {
		platform_order_id: raw.id,
		order_number: raw.orderNumber,
		customer_name: customerName,
		customer_email: raw.customerEmail || null,
		order_date: new Date(raw.createdOn),
		fulfillment_status: raw.fulfillmentStatus.toLowerCase(),
		subtotal: raw.subtotal?.value ?? null,
		shipping_total: raw.shippingTotal?.value ?? null,
		grand_total: raw.grandTotal?.value ?? null,
		promo_code:
			raw.discountLines?.find((line) => line.promoCode)?.promoCode ?? null,
		discount_total: raw.discountTotal?.value ?? '0',
		currency: raw.grandTotal?.currency ?? 'USD',
		fulfilled_on: applyOrNull(raw.fulfilledOn, (v) => new Date(v)),
		tracking_number: raw.fulfillments?.[0]?.trackingNumber ?? null,
		tracking_url: raw.fulfillments?.[0]?.trackingUrl ?? null,
		carrier_name: raw.fulfillments?.[0]?.carrierName ?? null,
		shipping_method: raw.shippingLines?.[0]?.method ?? null,
		order_notes:
			raw.internalNotes?.length > 0
				? raw.internalNotes.map((n) => n.content).join('\n')
				: null,
	};

	const items: Omit<NewOrderItem, 'order_id'>[] = raw.lineItems.map((item) => ({
		platform_line_item_id: item.id,
		platform_sku: item.sku || null,
		product_name: item.productName,
		variant_label:
			item.variantOptions?.length > 0
				? item.variantOptions.map((v) => ({
						name: v.optionName,
						value: v.value,
					}))
				: null,
		quantity: item.quantity,
		unit_price: item.unitPricePaid?.value ?? null,
		image_url: item.imageUrl || null,
	}));

	return { order, items };
}

async function fetchAllPages(
	apiKey: string,
	options: {
		fulfillmentStatus?: string;
		modifiedAfter?: string;
		modifiedBefore?: string;
	},
): Promise<NormalizedOrder[]> {
	const allOrders: NormalizedOrder[] = [];
	let cursor: string | null = null;

	do {
		const page = await fetchPage(apiKey, {
			fulfillmentStatus: cursor ? undefined : options.fulfillmentStatus,
			modifiedAfter: cursor ? undefined : options.modifiedAfter,
			modifiedBefore: cursor ? undefined : options.modifiedBefore,
			cursor: cursor ?? undefined,
		});

		for (const raw of page.result) {
			allOrders.push(normalizeOrder(raw));
		}

		cursor = page.pagination?.nextPageCursor ?? null;
	} while (cursor);

	return allOrders;
}

export async function testSquarespaceConnection(
	apiKey: string,
): Promise<boolean> {
	const response = await fetch(`${BASE_URL}?fulfillmentStatus=PENDING`, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
	});

	return response.ok;
}

export async function fetchSquarespaceOrders(
	apiKey: string,
	lastSyncedAt: Date | null,
): Promise<NormalizedOrder[]> {
	if (!lastSyncedAt) {
		return fetchAllPages(apiKey, {});
	}

	const modifiedAfter = lastSyncedAt.toISOString();
	const modifiedBefore = new Date().toISOString();

	const [pending, fulfilled] = await Promise.all([
		fetchAllPages(apiKey, { fulfillmentStatus: 'PENDING' }),
		fetchAllPages(apiKey, {
			fulfillmentStatus: 'FULFILLED',
			modifiedAfter,
			modifiedBefore,
		}),
	]);

	return [...pending, ...fulfilled];
}
