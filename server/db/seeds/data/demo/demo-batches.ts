export type DemoBatch = {
	name: string;
	status: 'Active' | 'Up Next' | 'Paused' | 'Completed';
	completedDayOffset: number | null;
	// Orders included by their dayOffset range (inclusive)
	assignByDayRange: { minDays: number; maxDays: number; fulfilled: boolean };
};

export const DEMO_BATCHES: DemoBatch[] = [
	{
		name: 'July Restock',
		status: 'Active',
		completedDayOffset: null,
		assignByDayRange: { minDays: 1, maxDays: 30, fulfilled: false },
	},
	{
		name: 'December Holiday Run',
		status: 'Completed',
		completedDayOffset: 30,
		assignByDayRange: { minDays: 30, maxDays: 90, fulfilled: true },
	},
	{
		name: 'Fall Popup Event',
		status: 'Completed',
		completedDayOffset: 85,
		assignByDayRange: { minDays: 90, maxDays: 120, fulfilled: true },
	},
];
