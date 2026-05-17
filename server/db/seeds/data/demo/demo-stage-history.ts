import { faker } from '@faker-js/faker';

const ORDER_STAGE_NAMES = [
	'New',
	'Cutting',
	'Stitching',
	'Edge Finishing',
	'Quality Check',
	'Shipped',
] as const;

type StageName = (typeof ORDER_STAGE_NAMES)[number];

const STAGE_HOUR_RANGES: Record<string, [number, number]> = {
	New: [4, 24],
	Cutting: [24, 72],
	Stitching: [48, 120],
	'Edge Finishing': [24, 48],
	'Quality Check': [4, 24],
};

export type StageTransition = {
	fromStage: StageName;
	toStage: StageName;
	at: Date;
};

export function buildOrderStageHistory(params: {
	orderIdx: number;
	orderDate: Date;
	currentStageName: string;
	fulfilled: boolean;
	fulfilledOn: Date | null;
	now: Date;
}): StageTransition[] {
	const { orderIdx, orderDate, currentStageName, fulfilled, fulfilledOn, now } =
		params;

	faker.seed(orderIdx);

	const currentIdx = ORDER_STAGE_NAMES.indexOf(currentStageName as StageName);
	let path: StageName[];

	if (fulfilled) {
		path = [...ORDER_STAGE_NAMES.slice(1)];
	} else if (currentIdx > 0) {
		path = [...ORDER_STAGE_NAMES.slice(1, currentIdx + 1)];
	} else {
		return [];
	}

	const transitions: StageTransition[] = [];
	let currentTime = orderDate.getTime();

	for (let i = 0; i < path.length; i++) {
		const fromStage = i === 0 ? ('New' as StageName) : path[i - 1];
		const [minHours, maxHours] = STAGE_HOUR_RANGES[fromStage] ?? [12, 48];
		const hoursInStage = faker.number.float({ min: minHours, max: maxHours });
		currentTime += hoursInStage * 60 * 60 * 1000;
		transitions.push({
			fromStage,
			toStage: path[i],
			at: new Date(currentTime),
		});
	}

	if (fulfilled && fulfilledOn && transitions.length > 0) {
		const generatedEnd = transitions[transitions.length - 1].at.getTime();
		const start = orderDate.getTime();
		const actualEnd = fulfilledOn.getTime();
		const totalGenerated = generatedEnd - start;
		const totalActual = actualEnd - start;

		if (totalGenerated > 0 && totalActual > 0) {
			const scale = totalActual / totalGenerated;
			for (const t of transitions) {
				const elapsed = t.at.getTime() - start;
				t.at = new Date(start + elapsed * scale);
			}
		}
	} else if (!fulfilled && transitions.length > 0) {
		const lastTime = transitions[transitions.length - 1].at.getTime();
		const nowTime = now.getTime();
		if (lastTime > nowTime) {
			const start = orderDate.getTime();
			const scale = (nowTime - start - 60 * 60 * 1000) / (lastTime - start);
			for (const t of transitions) {
				const elapsed = t.at.getTime() - start;
				t.at = new Date(start + elapsed * scale);
			}
		}
	}

	return transitions;
}
