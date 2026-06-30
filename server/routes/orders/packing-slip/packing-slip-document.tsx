import {
	Document,
	Page,
	View,
	Text,
	Image,
	StyleSheet,
} from '@react-pdf/renderer';
import type { ShippingAddress } from '../../../db/database-types.js';

export type SlipItem = {
	product_name: string;
	variant_label: { name: string; value: string }[] | null;
	quantity: number;
};

export type SlipOrder = {
	order_number: string;
	order_date: Date;
	customer_name: string | null;
	shipping_address: ShippingAddress | null;
	items: SlipItem[];
};

type PackingSlipProps = {
	storeName: string;
	logoUrl: string | null;
	tagline: string | null;
	websiteUrl: string | null;
	contactEmail: string | null;
	timeZone: string;
	orders: SlipOrder[];
};

const SLIP_SIZE: [number, number] = [288, 432];

const styles = StyleSheet.create({
	page: {
		paddingVertical: 20,
		paddingHorizontal: 18,
		fontSize: 9,
		color: '#1a1a1a',
		fontFamily: 'Helvetica',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 10,
	},
	brand: {
		flexShrink: 1,
		paddingRight: 12,
	},
	storeName: {
		fontSize: 13,
		fontFamily: 'Helvetica-Bold',
	},
	logo: {
		height: 32,
		marginBottom: 4,
	},
	tagline: {
		fontSize: 8,
		color: '#555555',
		marginTop: 2,
	},
	brandMeta: {
		fontSize: 7,
		color: '#888888',
		marginTop: 2,
	},
	orderMeta: {
		textAlign: 'right',
		color: '#555555',
		fontSize: 8,
	},
	orderNumber: {
		fontSize: 10,
		fontFamily: 'Helvetica-Bold',
		color: '#1a1a1a',
		marginBottom: 2,
	},
	itemCount: {
		marginTop: 4,
	},
	shipTo: {
		marginBottom: 20,
	},
	shipToLabel: {
		fontSize: 7,
		color: '#888888',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginBottom: 3,
	},
	tableHeader: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: '#1a1a1a',
		paddingBottom: 4,
		marginBottom: 2,
		fontSize: 7,
		color: '#888888',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		borderBottomWidth: 1,
		borderBottomColor: '#eeeeee',
		paddingVertical: 5,
	},
	checkCell: {
		width: 22,
	},
	checkbox: {
		width: 10,
		height: 10,
		borderWidth: 1,
		borderColor: '#999999',
		borderRadius: 2,
	},
	qtyCell: {
		width: 30,
	},
	itemCell: {
		flex: 1,
	},
	variant: {
		color: '#666666',
		fontSize: 8,
		marginTop: 1,
	},
});

function formatDate(date: Date, timeZone: string): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone,
	}).format(date);
}

function formatVariant(variant: SlipItem['variant_label']): string | null {
	if (!variant?.length) return null;
	const values = variant.map((option) => option.value).filter(Boolean);
	return values.length ? values.join(', ') : null;
}

function stripProtocol(url: string): string {
	return url.replace(/^https?:\/\//, '');
}

function addressLines(address: ShippingAddress): string[] {
	const name = [address.first_name, address.last_name]
		.filter(Boolean)
		.join(' ');
	const cityLine = [address.city, address.state, address.postal_code]
		.filter(Boolean)
		.join(', ');
	return [name, address.address1, address.address2, cityLine].filter(
		(line): line is string => Boolean(line),
	);
}

export function PackingSlipDocument({
	storeName,
	logoUrl,
	tagline,
	websiteUrl,
	contactEmail,
	timeZone,
	orders,
}: PackingSlipProps) {
	return (
		<Document>
			{orders.map((order) => {
				const itemCount = order.items.reduce(
					(sum, item) => sum + item.quantity,
					0,
				);
				return (
					<Page key={order.order_number} size={SLIP_SIZE} style={styles.page}>
					<View style={styles.header}>
						<View style={styles.brand}>
								{logoUrl ? (
									<Image src={logoUrl} style={styles.logo} />
								) : (
									<Text style={styles.storeName}>{storeName}</Text>
								)}
								{tagline && <Text style={styles.tagline}>{tagline}</Text>}
								{websiteUrl && (
									<Text style={styles.brandMeta}>{stripProtocol(websiteUrl)}</Text>
								)}
								{contactEmail && (
									<Text style={styles.brandMeta}>{contactEmail}</Text>
								)}
							</View>
						<View style={styles.orderMeta}>
							<Text style={styles.orderNumber}>Order #{order.order_number}</Text>
							<Text>{formatDate(order.order_date, timeZone)}</Text>
							<Text style={styles.itemCount}>
								{itemCount} {itemCount === 1 ? 'item' : 'items'}
							</Text>
						</View>
					</View>

					{order.shipping_address ? (
						<View style={styles.shipTo}>
							<Text style={styles.shipToLabel}>Ship to</Text>
							{addressLines(order.shipping_address).map((line, index) => (
								<Text key={index}>{line}</Text>
							))}
						</View>
					) : (
						order.customer_name && (
							<View style={styles.shipTo}>
								<Text style={styles.shipToLabel}>Customer</Text>
								<Text>{order.customer_name}</Text>
							</View>
						)
					)}

					<View style={styles.tableHeader}>
						<Text style={styles.checkCell} />
						<Text style={styles.qtyCell}>Qty</Text>
						<Text style={styles.itemCell}>Item</Text>
					</View>

					{order.items.map((item, index) => {
						const variant = formatVariant(item.variant_label);
						return (
							<View key={index} style={styles.row} wrap={false}>
								<View style={styles.checkCell}>
									<View style={styles.checkbox} />
								</View>
								<Text style={styles.qtyCell}>{item.quantity}</Text>
								<View style={styles.itemCell}>
									<Text>{item.product_name}</Text>
									{variant && <Text style={styles.variant}>{variant}</Text>}
								</View>
							</View>
						);
					})}
				</Page>
				);
			})}
		</Document>
	);
}
