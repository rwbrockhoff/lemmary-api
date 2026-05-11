export type DemoOrderItem = {
	platformSku: string;
	quantity: number;
};

export type DemoOrderSpec = {
	dayOffset: number;
	customerIndex: number;
	stageName: string;
	fulfilled: boolean;
	items: DemoOrderItem[];
};

// 40 orders across 120 days:
//   12 in last 30 days (mostly pending/in-progress)
//   14 in 30-90 days (mix in-progress + shipped)
//   14 in 90-120 days (mostly shipped)
export const DEMO_ORDERS: DemoOrderSpec[] = [
	// Recent 30 days — pending, cutting, stitching
	{
		dayOffset: 1,
		customerIndex: 0,
		stageName: 'New',
		fulfilled: false,
		items: [{ platformSku: 'TS-WAL-BLK', quantity: 1 }],
	},
	{
		dayOffset: 2,
		customerIndex: 1,
		stageName: 'New',
		fulfilled: false,
		items: [
			{ platformSku: 'TS-CRD-COG', quantity: 1 },
			{ platformSku: 'TS-FOB-COG', quantity: 1 },
		],
	},
	{
		dayOffset: 3,
		customerIndex: 2,
		stageName: 'New',
		fulfilled: false,
		items: [{ platformSku: 'TS-CRO-TAN', quantity: 1 }],
	},
	{
		dayOffset: 4,
		customerIndex: 3,
		stageName: 'New',
		fulfilled: false,
		items: [
			{ platformSku: 'TS-WAL-TAN', quantity: 1 },
			{ platformSku: 'TS-CRD-TAN', quantity: 1 },
		],
	},
	{
		dayOffset: 6,
		customerIndex: 4,
		stageName: 'Cutting',
		fulfilled: false,
		items: [{ platformSku: 'TS-LAP-13-BLK', quantity: 1 }],
	},
	{
		dayOffset: 7,
		customerIndex: 5,
		stageName: 'Cutting',
		fulfilled: false,
		items: [{ platformSku: 'TS-TOT-BLK', quantity: 1 }],
	},
	{
		dayOffset: 8,
		customerIndex: 6,
		stageName: 'Cutting',
		fulfilled: false,
		items: [{ platformSku: 'TS-CRD-BUR', quantity: 2 }],
	},
	{
		dayOffset: 9,
		customerIndex: 7,
		stageName: 'Cutting',
		fulfilled: false,
		items: [
			{ platformSku: 'TS-FOB-BLK', quantity: 1 },
			{ platformSku: 'TS-WAL-COG', quantity: 1 },
		],
	},
	{
		dayOffset: 14,
		customerIndex: 8,
		stageName: 'Stitching',
		fulfilled: false,
		items: [{ platformSku: 'TS-LAP-15-TAN', quantity: 1 }],
	},
	{
		dayOffset: 16,
		customerIndex: 9,
		stageName: 'Stitching',
		fulfilled: false,
		items: [
			{ platformSku: 'TS-CRO-BLK', quantity: 1 },
			{ platformSku: 'TS-FOB-NVY', quantity: 2 },
		],
	},
	{
		dayOffset: 18,
		customerIndex: 10,
		stageName: 'Stitching',
		fulfilled: false,
		items: [
			{ platformSku: 'TS-TOT-TAN', quantity: 1 },
			{ platformSku: 'TS-CRD-BLK', quantity: 1 },
		],
	},
	{
		dayOffset: 20,
		customerIndex: 11,
		stageName: 'Stitching',
		fulfilled: false,
		items: [{ platformSku: 'TS-WAL-BLK', quantity: 1 }],
	},

	// 30-90 days — mid workflow + some shipped
	{
		dayOffset: 32,
		customerIndex: 12,
		stageName: 'Edge Finishing',
		fulfilled: false,
		items: [{ platformSku: 'TS-LAP-13-TAN', quantity: 1 }],
	},
	{
		dayOffset: 34,
		customerIndex: 13,
		stageName: 'Edge Finishing',
		fulfilled: false,
		items: [
			{ platformSku: 'TS-CRD-BLK', quantity: 1 },
			{ platformSku: 'TS-FOB-TAN', quantity: 1 },
		],
	},
	{
		dayOffset: 36,
		customerIndex: 14,
		stageName: 'Edge Finishing',
		fulfilled: false,
		items: [{ platformSku: 'TS-TOT-BLK', quantity: 1 }],
	},
	{
		dayOffset: 38,
		customerIndex: 15,
		stageName: 'Edge Finishing',
		fulfilled: false,
		items: [{ platformSku: 'TS-WAL-COG', quantity: 2 }],
	},
	{
		dayOffset: 45,
		customerIndex: 16,
		stageName: 'Quality Check',
		fulfilled: false,
		items: [{ platformSku: 'TS-CRO-TAN', quantity: 1 }],
	},
	{
		dayOffset: 47,
		customerIndex: 17,
		stageName: 'Quality Check',
		fulfilled: false,
		items: [
			{ platformSku: 'TS-LAP-15-BLK', quantity: 1 },
			{ platformSku: 'TS-FOB-COG', quantity: 1 },
		],
	},
	{
		dayOffset: 50,
		customerIndex: 18,
		stageName: 'Quality Check',
		fulfilled: false,
		items: [{ platformSku: 'TS-CRD-TAN', quantity: 1 }],
	},
	{
		dayOffset: 55,
		customerIndex: 19,
		stageName: 'Quality Check',
		fulfilled: false,
		items: [
			{ platformSku: 'TS-WAL-TAN', quantity: 1 },
			{ platformSku: 'TS-FOB-BLK', quantity: 1 },
		],
	},
	{
		dayOffset: 62,
		customerIndex: 20,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-TOT-TAN', quantity: 1 }],
	},
	{
		dayOffset: 65,
		customerIndex: 21,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-CRD-COG', quantity: 1 }],
	},
	{
		dayOffset: 70,
		customerIndex: 22,
		stageName: 'Shipped',
		fulfilled: true,
		items: [
			{ platformSku: 'TS-LAP-13-BLK', quantity: 1 },
			{ platformSku: 'TS-WAL-BLK', quantity: 1 },
		],
	},
	{
		dayOffset: 75,
		customerIndex: 23,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-CRO-BLK', quantity: 1 }],
	},
	{
		dayOffset: 80,
		customerIndex: 24,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-FOB-NVY', quantity: 3 }],
	},
	{
		dayOffset: 85,
		customerIndex: 25,
		stageName: 'Shipped',
		fulfilled: true,
		items: [
			{ platformSku: 'TS-WAL-COG', quantity: 1 },
			{ platformSku: 'TS-CRD-BUR', quantity: 1 },
		],
	},

	// 90-120 days — mostly shipped
	{
		dayOffset: 92,
		customerIndex: 26,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-TOT-BLK', quantity: 1 }],
	},
	{
		dayOffset: 95,
		customerIndex: 27,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-LAP-15-TAN', quantity: 1 }],
	},
	{
		dayOffset: 98,
		customerIndex: 28,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-CRD-TAN', quantity: 2 }],
	},
	{
		dayOffset: 100,
		customerIndex: 29,
		stageName: 'Shipped',
		fulfilled: true,
		items: [
			{ platformSku: 'TS-WAL-BLK', quantity: 1 },
			{ platformSku: 'TS-FOB-BLK', quantity: 1 },
		],
	},
	{
		dayOffset: 103,
		customerIndex: 30,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-CRO-TAN', quantity: 1 }],
	},
	{
		dayOffset: 105,
		customerIndex: 31,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-LAP-13-TAN', quantity: 1 }],
	},
	{
		dayOffset: 108,
		customerIndex: 32,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-FOB-COG', quantity: 2 }],
	},
	{
		dayOffset: 110,
		customerIndex: 33,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-WAL-TAN', quantity: 1 }],
	},
	{
		dayOffset: 112,
		customerIndex: 34,
		stageName: 'Shipped',
		fulfilled: true,
		items: [
			{ platformSku: 'TS-TOT-TAN', quantity: 1 },
			{ platformSku: 'TS-CRD-COG', quantity: 1 },
		],
	},
	{
		dayOffset: 114,
		customerIndex: 35,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-LAP-15-BLK', quantity: 1 }],
	},
	{
		dayOffset: 116,
		customerIndex: 36,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-CRD-BLK', quantity: 1 }],
	},
	{
		dayOffset: 117,
		customerIndex: 37,
		stageName: 'Shipped',
		fulfilled: true,
		items: [
			{ platformSku: 'TS-WAL-COG', quantity: 1 },
			{ platformSku: 'TS-FOB-TAN', quantity: 1 },
		],
	},
	{
		dayOffset: 118,
		customerIndex: 38,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-CRO-BLK', quantity: 1 }],
	},
	{
		dayOffset: 119,
		customerIndex: 39,
		stageName: 'Shipped',
		fulfilled: true,
		items: [{ platformSku: 'TS-FOB-NVY', quantity: 1 }],
	},
];
