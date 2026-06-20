import type {
	NewProduct,
	NewProductVariant,
} from '../../../db/database-types.js';
import {
	shopifyGraphql,
	type Connection,
	type PageInfo,
} from '../../shopify/shopify-graphql.js';
import type { NormalizedProduct } from './product-types.js';

// Mirrors exactly the fields we ask for in PRODUCTS_QUERY
type ShopifyVariant = {
	id: string;
	sku: string | null;
	title: string;
	price: string;
	compareAtPrice: string | null;
	inventoryQuantity: number | null;
	image: { url: string } | null;
};

type ShopifyProduct = {
	id: string;
	title: string;
	description: string | null;
	handle: string;
	status: string;
	onlineStoreUrl: string | null;
	featuredImage: { url: string } | null;
	variants: Connection<ShopifyVariant>;
};

type ProductsResponse = {
	products: Connection<ShopifyProduct> & { pageInfo: PageInfo };
};

const PRODUCTS_QUERY = `
	query Products($cursor: String) {
		products(first: 100, after: $cursor) {
			edges {
				node {
					id
					title
					description
					handle
					status
					onlineStoreUrl
					featuredImage { url }
					variants(first: 100) {
						edges {
							node {
								id
								sku
								title
								price
								compareAtPrice
								inventoryQuantity
								image { url }
							}
						}
					}
				}
			}
			pageInfo { hasNextPage endCursor }
		}
	}
`;

function normalizeProduct(node: ShopifyProduct): NormalizedProduct {
	const product: Omit<NewProduct, 'store_id'> = {
		platform_product_id: node.id,
		name: node.title,
		description: node.description || null,
		slug: node.handle || null,
		// Shopify products are ACTIVE / DRAFT / ARCHIVED -> only ACTIVE is live
		is_visible: node.status === 'ACTIVE',
		image_url: node.featuredImage?.url ?? null,
		product_url: node.onlineStoreUrl || null,
	};

	const variants: Omit<NewProductVariant, 'product_id'>[] =
		node.variants.edges.map(({ node: v }) => {
			// Shopify marks a sale with compareAtPrice (the struck-through original).
			// We store regular price + the discounted sale price to match our shape.
			const onSale =
				v.compareAtPrice != null && Number(v.compareAtPrice) > Number(v.price);

			return {
				platform_variant_id: v.id,
				platform_sku: v.sku || null,
				name: v.title,
				price: onSale ? v.compareAtPrice : v.price,
				sale_price: onSale ? v.price : null,
				on_sale: onSale,
				stock_quantity: v.inventoryQuantity ?? null,
				stock_unlimited: false,
				image_url: v.image?.url ?? null,
			};
		});

	return { product, variants };
}

export async function fetchShopifyProducts(
	shop: string,
	token: string,
): Promise<NormalizedProduct[]> {
	const allProducts: NormalizedProduct[] = [];
	let cursor: string | null = null;

	do {
		const data: ProductsResponse = await shopifyGraphql(
			shop,
			token,
			PRODUCTS_QUERY,
			{ cursor },
		);

		for (const edge of data.products.edges) {
			allProducts.push(normalizeProduct(edge.node));
		}

		cursor = data.products.pageInfo.hasNextPage
			? data.products.pageInfo.endCursor
			: null;
	} while (cursor);

	return allProducts;
}
