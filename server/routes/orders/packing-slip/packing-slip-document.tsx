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
		color: '#000000',
		fontFamily: 'Helvetica',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 14,
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
		width: 120,
		height: 36,
		objectFit: 'contain',
		objectPositionX: 0,
		marginBottom: 4,
	},
	tagline: {
		fontSize: 8,
		color: '#000000',
		marginTop: 2,
	},
	brandMeta: {
		fontSize: 7,
		color: '#000000',
		marginTop: 2,
	},
	orderNumber: {
		fontSize: 10,
		fontFamily: 'Helvetica-Bold',
		color: '#000000',
	},
	infoRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: 14,
	},
	shipTo: {
		width: 150,
	},
	orderInfo: {
		paddingLeft: 12,
	},
	shipToLabel: {
		fontSize: 7,
		color: '#000000',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginBottom: 3,
	},
	addressLine: {
		marginBottom: 1,
	},
	tableHeader: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: '#000000',
		paddingBottom: 4,
		marginBottom: 2,
		fontSize: 7,
		color: '#000000',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 5,
	},
	checkCell: {
		width: 22,
	},
	checkbox: {
		width: 10,
		height: 10,
		borderWidth: 1,
		borderColor: '#000000',
		borderRadius: 2,
	},
	qtyCell: {
		width: 30,
	},
	itemCell: {
		flex: 1,
	},
	variant: {
		color: '#000000',
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

// One variant per line so it's easier to read customizations
function variantValues(variant: SlipItem['variant_label']): string[] {
	if (!variant?.length) return [];
	return variant.map((option) => option.value).filter(Boolean);
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
						<Text style={styles.orderNumber}>Order #{order.order_number}</Text>
					</View>

					<View style={styles.infoRow}>
						{order.shipping_address ? (
							<View style={styles.shipTo}>
								<Text style={styles.shipToLabel}>Ship to</Text>
								{addressLines(order.shipping_address).map((line, index) => (
									<Text key={index} style={styles.addressLine}>
										{line}
									</Text>
								))}
							</View>
						) : order.customer_name ? (
							<View style={styles.shipTo}>
								<Text style={styles.shipToLabel}>Customer</Text>
								<Text>{order.customer_name}</Text>
							</View>
						) : (
							<View />
						)}
						<View style={styles.orderInfo}>
							<Text style={styles.shipToLabel}>Order</Text>
							<Text>{formatDate(order.order_date, timeZone)}</Text>
						</View>
					</View>

					<View style={styles.tableHeader}>
						<Text style={styles.checkCell} />
						<Text style={styles.qtyCell}>Qty</Text>
						<Text style={styles.itemCell}>Item</Text>
					</View>

					{order.items.map((item, index) => {
						const variants = variantValues(item.variant_label);
						return (
							<View key={index} style={styles.row} wrap={false}>
								<View style={styles.checkCell}>
									<View style={styles.checkbox} />
								</View>
								<Text style={styles.qtyCell}>{item.quantity}</Text>
								<View style={styles.itemCell}>
									<Text>{item.product_name}</Text>
									{variants.map((value, i) => (
										<Text key={i} style={styles.variant}>
											{value}
										</Text>
									))}
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
