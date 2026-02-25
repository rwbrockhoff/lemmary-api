import type { NewOrder, NewOrderItem } from '../../../db/database-types.js';

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
	lineItems: SquarespaceLineItem[];
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
	params?: { fulfillmentStatus?: string; cursor?: string },
): Promise<SquarespaceResponse> {
	let url = BASE_URL;

	if (params?.cursor) {
		url += `?cursor=${params.cursor}`;
	} else if (params?.fulfillmentStatus) {
		url += `?fulfillmentStatus=${params.fulfillmentStatus}`;
	}

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
		currency: raw.grandTotal?.currency ?? 'USD',
	};

	const items: Omit<NewOrderItem, 'order_id'>[] = raw.lineItems.map(
		(item) => ({
			platform_line_item_id: item.id,
			platform_sku: item.sku || null,
			product_name: item.productName,
			variant_label: item.variantOptions?.[0]?.value || null,
			quantity: item.quantity,
			unit_price: item.unitPricePaid?.value ?? null,
			image_url: item.imageUrl || null,
		}),
	);

	return { order, items };
}

export async function fetchSquarespaceOrders(
	apiKey: string,
	fulfillmentStatus = 'PENDING',
): Promise<NormalizedOrder[]> {
	const allOrders: NormalizedOrder[] = [];
	let cursor: string | null = null;

	do {
		const page = await fetchPage(apiKey, {
			fulfillmentStatus: cursor ? undefined : fulfillmentStatus,
			cursor: cursor ?? undefined,
		});

		for (const raw of page.result) {
			allOrders.push(normalizeOrder(raw));
		}

		cursor = page.pagination?.nextPageCursor ?? null;
	} while (cursor);

	return allOrders;
}
