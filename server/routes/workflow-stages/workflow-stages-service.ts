import type { UpdateObject } from 'kysely';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';
import type { Database } from '../../db/database-types.js';
import type {
	CreateWorkflowStageRequestSchema,
	UpdateWorkflowStageRequestSchema,
	ReorderWorkflowStagesRequestSchema,
} from './contract/schemas.js';

type CreateInput = z.infer<typeof CreateWorkflowStageRequestSchema>;
type UpdateInput = z.infer<typeof UpdateWorkflowStageRequestSchema>;
type ReorderInput = z.infer<typeof ReorderWorkflowStagesRequestSchema>;

type StageRow = {
	id: string;
	name: string;
	position: number;
	color: string | null;
};

type StageSuccess = {
	ok: true;
	stage: StageRow;
};

type StageError = {
	ok: false;
	error: 'no_store' | 'not_found' | 'has_orders' | 'is_default';
};

type StageResult = StageSuccess | StageError;

type SimpleSuccess = { ok: true };
type SimpleResult = SimpleSuccess | StageError;

export async function getWorkflowStages(userId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return { orderStages: [], itemStages: [] };

	const orderStages = await db
		.selectFrom('order_workflow_stages')
		.selectAll()
		.where('store_id', '=', store.id)
		.orderBy('position', 'asc')
		.execute();

	const itemStages = await db
		.selectFrom('order_item_workflow_stages')
		.selectAll()
		.where('store_id', '=', store.id)
		.orderBy('position', 'asc')
		.execute();

	return { orderStages, itemStages };
}

export async function createWorkflowStage(
	userId: string,
	input: CreateInput,
): Promise<StageResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	const maxPositionRow = await db
		.selectFrom('order_workflow_stages')
		.select(db.fn.max('position').as('max_position'))
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	const nextPosition =
		typeof maxPositionRow?.max_position === 'number'
			? maxPositionRow.max_position + 1
			: 0;

	const inserted = await db
		.insertInto('order_workflow_stages')
		.values({
			store_id: store.id,
			name: input.name,
			color: input.color ?? null,
			position: nextPosition,
		})
		.returning(['id', 'name', 'position', 'color'])
		.executeTakeFirstOrThrow();

	return { ok: true, stage: inserted };
}

export async function updateWorkflowStage(
	userId: string,
	stageId: string,
	updates: UpdateInput,
): Promise<StageResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	const set: UpdateObject<Database, 'order_workflow_stages'> = {
		updated_at: new Date(),
	};

	if (updates.name !== undefined) {
		set.name = updates.name;
	}

	if (updates.color !== undefined) {
		set.color = updates.color;
	}

	const updated = await db
		.updateTable('order_workflow_stages')
		.set(set)
		.where('id', '=', stageId)
		.where('store_id', '=', store.id)
		.returning(['id', 'name', 'position', 'color'])
		.executeTakeFirst();

	if (!updated) return { ok: false, error: 'not_found' };
	return { ok: true, stage: updated };
}

export async function deleteWorkflowStage(
	userId: string,
	stageId: string,
): Promise<SimpleResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	const stage = await db
		.selectFrom('order_workflow_stages')
		.select(['id', 'is_default'])
		.where('id', '=', stageId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!stage) return { ok: false, error: 'not_found' };
	if (stage.is_default) return { ok: false, error: 'is_default' };

	const orderUsing = await db
		.selectFrom('orders')
		.select('id')
		.where('workflow_stage_id', '=', stageId)
		.limit(1)
		.executeTakeFirst();

	if (orderUsing) return { ok: false, error: 'has_orders' };

	await db
		.deleteFrom('order_workflow_stages')
		.where('id', '=', stageId)
		.where('store_id', '=', store.id)
		.execute();

	return { ok: true };
}

export async function reorderWorkflowStages(
	userId: string,
	input: ReorderInput,
): Promise<SimpleResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	await db.transaction().execute(async (trx) => {
		for (let i = 0; i < input.orderedIds.length; i++) {
			await trx
				.updateTable('order_workflow_stages')
				.set({ position: i, updated_at: new Date() })
				.where('id', '=', input.orderedIds[i])
				.where('store_id', '=', store.id)
				.execute();
		}
	});

	return { ok: true };
}
