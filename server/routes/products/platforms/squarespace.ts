import type {
	NewProduct,
	NewProductVariant,
} from '../../../db/database-types.js';
import type { NormalizedProduct } from './product-types.js';

const BASE_URL = 'https://api.squarespace.com/1.0/commerce/products';

type SquarespaceImage = {
	id: string;
	url: string;
	originalSize: { width: number; height: number };
};

type SquarespaceVariantAttribute = {
	[key: string]: string;
};

type SquarespaceVariantPricing = {
	basePrice: { value: string; currency: string };
	salePrice: { value: string; currency: string } | null;
	onSale: boolean;
};

type SquarespaceVariant = {
	id: string;
	sku: string;
	pricing: SquarespaceVariantPricing;
	stock: { quantity: number; unlimited: boolean };
	attributes: SquarespaceVariantAttribute;
	image: SquarespaceImage | null;
};

type SquarespaceProduct = {
	id: string;
	name: string;
	description: string;
	url: string;
	urlSlug: string;
	isVisible: boolean;
	images: SquarespaceImage[];
	variants: SquarespaceVariant[];
};

type SquarespaceProductsResponse = {
	products: SquarespaceProduct[];
	pagination: {
		hasNextPage: boolean;
		nextPageCursor: string | null;
		nextPageUrl: string | null;
	};
};

function buildVariantName(attributes: SquarespaceVariantAttribute): string {
	const values = Object.values(attributes);
	return values.length > 0 ? values.join(' / ') : 'Default';
}

async function fetchPage(
	apiKey: string,
	cursor?: string,
): Promise<SquarespaceProductsResponse> {
	const searchParams = new URLSearchParams();
	if (cursor) {
		searchParams.set('cursor', cursor);
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
		throw new Error(
			`Squarespace Products API error ${response.status}: ${text}`,
		);
	}

	return response.json() as Promise<SquarespaceProductsResponse>;
}

function normalizeProduct(raw: SquarespaceProduct): NormalizedProduct {
	const product: Omit<NewProduct, 'store_id'> = {
		platform_product_id: raw.id,
		name: raw.name,
		description: raw.description || null,
		slug: raw.urlSlug || null,
		is_visible: raw.isVisible,
		image_url: raw.images?.[0]?.url ?? null,
		product_url: raw.url || null,
	};

	const variants: Omit<NewProductVariant, 'product_id'>[] = raw.variants.map(
		(v) => ({
			platform_variant_id: v.id,
			platform_sku: v.sku || null,
			name: buildVariantName(v.attributes),
			price: v.pricing?.basePrice?.value ?? null,
			sale_price: v.pricing?.salePrice?.value ?? null,
			on_sale: v.pricing?.onSale ?? false,
			stock_quantity: v.stock?.unlimited ? null : (v.stock?.quantity ?? null),
			stock_unlimited: v.stock?.unlimited ?? false,
			image_url: v.image?.url ?? null,
		}),
	);

	return { product, variants };
}

export async function fetchSquarespaceProducts(
	apiKey: string,
): Promise<NormalizedProduct[]> {
	const allProducts: NormalizedProduct[] = [];
	let cursor: string | undefined;

	do {
		const page = await fetchPage(apiKey, cursor);

		for (const raw of page.products) {
			allProducts.push(normalizeProduct(raw));
		}

		cursor = page.pagination?.nextPageCursor ?? undefined;
	} while (cursor);

	return allProducts;
}
