import { sql, type UpdateObject } from 'kysely';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';
import { setColumn } from '../../utils/update.js';
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
	error: 'no_store' | 'not_found' | 'is_default';
};

type StageResult = StageSuccess | StageError;

type SimpleSuccess = { ok: true };
type SimpleResult = SimpleSuccess | StageError;

type AffectedOrder = {
	orderNumber: string;
	customerName: string | null;
};

type DeleteBlocked = {
	ok: false;
	error: 'has_items';
	affectedOrders: AffectedOrder[];
	affectedCount: number;
	suggestedReassignStageId: string | null;
};

type DeleteInvalidReassign = {
	ok: false;
	error: 'invalid_reassign';
};

type DeleteItemStageResult =
	| SimpleSuccess
	| StageError
	| DeleteBlocked
	| DeleteInvalidReassign;

const AFFECTED_ORDERS_LIMIT = 5;

export async function getItemStages(userId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return [];

	return db
		.selectFrom('order_item_workflow_stages')
		.selectAll()
		.where('store_id', '=', store.id)
		.where('archived_at', 'is', null)
		.orderBy('position', 'asc')
		.execute();
}

export async function createItemStage(
	userId: string,
	input: CreateInput,
): Promise<StageResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	const maxPositionRow = await db
		.selectFrom('order_item_workflow_stages')
		.select(db.fn.max('position').as('max_position'))
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	const nextPosition =
		typeof maxPositionRow?.max_position === 'number'
			? maxPositionRow.max_position + 1
			: 0;

	const inserted = await db
		.insertInto('order_item_workflow_stages')
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

export async function updateItemStage(
	userId: string,
	stageId: string,
	updates: UpdateInput,
): Promise<StageResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	const set: UpdateObject<Database, 'order_item_workflow_stages'> = {
		updated_at: sql`NOW()`,
	};

	setColumn(set, 'name', updates.name);
	setColumn(set, 'color', updates.color);

	const updated = await db
		.updateTable('order_item_workflow_stages')
		.set(set)
		.where('id', '=', stageId)
		.where('store_id', '=', store.id)
		.returning(['id', 'name', 'position', 'color'])
		.executeTakeFirst();

	if (!updated) return { ok: false, error: 'not_found' };
	return { ok: true, stage: updated };
}

async function getSuggestedReassignStageId(
	storeId: string,
	stageId: string,
	position: number,
): Promise<string | null> {
	const previous = await db
		.selectFrom('order_item_workflow_stages')
		.select('id')
		.where('store_id', '=', storeId)
		.where('archived_at', 'is', null)
		.where('id', '!=', stageId)
		.where('position', '<', position)
		.orderBy('position', 'desc')
		.limit(1)
		.executeTakeFirst();

	if (previous) return previous.id;

	const fallback = await db
		.selectFrom('order_item_workflow_stages')
		.select('id')
		.where('store_id', '=', storeId)
		.where('archived_at', 'is', null)
		.where('is_default', '=', true)
		.executeTakeFirst();

	return fallback?.id ?? null;
}

type AffectedOrderRow = {
	orderId: string;
	orderNumber: string;
	customerName: string | null;
};

async function getAffectedOrders(
	storeId: string,
	stageId: string,
): Promise<AffectedOrderRow[]> {
	return db
		.selectFrom('order_items')
		.innerJoin('orders', 'orders.id', 'order_items.order_id')
		.select([
			'orders.id as orderId',
			'orders.order_number as orderNumber',
			'orders.customer_name as customerName',
		])
		.where('order_items.workflow_stage_id', '=', stageId)
		.where('orders.store_id', '=', storeId)
		.distinct()
		.orderBy('orders.order_number', 'asc')
		.execute();
}

async function buildDeleteBlocked(
	storeId: string,
	stageId: string,
	position: number,
	affectedOrders: AffectedOrderRow[],
): Promise<DeleteBlocked> {
	const suggestedReassignStageId = await getSuggestedReassignStageId(
		storeId,
		stageId,
		position,
	);

	return {
		ok: false,
		error: 'has_items',
		affectedOrders: affectedOrders
			.slice(0, AFFECTED_ORDERS_LIMIT)
			.map((order) => ({
				orderNumber: order.orderNumber,
				customerName: order.customerName,
			})),
		affectedCount: affectedOrders.length,
		suggestedReassignStageId,
	};
}

export async function deleteItemStage(
	userId: string,
	stageId: string,
	reassignStageId?: string,
): Promise<DeleteItemStageResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	const stage = await db
		.selectFrom('order_item_workflow_stages')
		.select(['id', 'is_default', 'position'])
		.where('id', '=', stageId)
		.where('store_id', '=', store.id)
		.where('archived_at', 'is', null)
		.executeTakeFirst();

	if (!stage) return { ok: false, error: 'not_found' };
	if (stage.is_default) return { ok: false, error: 'is_default' };

	const affectedOrders = await getAffectedOrders(store.id, stageId);

	if (affectedOrders.length === 0) {
		await db
			.updateTable('order_item_workflow_stages')
			.set({ archived_at: sql`NOW()`, updated_at: sql`NOW()` })
			.where('id', '=', stageId)
			.where('store_id', '=', store.id)
			.execute();

		return { ok: true };
	}

	if (!reassignStageId) {
		return buildDeleteBlocked(
			store.id,
			stageId,
			stage.position,
			affectedOrders,
		);
	}

	if (reassignStageId === stageId) {
		return { ok: false, error: 'invalid_reassign' };
	}

	const target = await db
		.selectFrom('order_item_workflow_stages')
		.select('id')
		.where('id', '=', reassignStageId)
		.where('store_id', '=', store.id)
		.where('archived_at', 'is', null)
		.executeTakeFirst();

	if (!target) return { ok: false, error: 'invalid_reassign' };

	await db.transaction().execute(async (trx) => {
		await trx
			.updateTable('order_items')
			.set({ workflow_stage_id: reassignStageId, updated_at: sql`NOW()` })
			.where('workflow_stage_id', '=', stageId)
			.execute();

		await trx
			.updateTable('order_item_workflow_stages')
			.set({ archived_at: sql`NOW()`, updated_at: sql`NOW()` })
			.where('id', '=', stageId)
			.where('store_id', '=', store.id)
			.execute();
	});

	return { ok: true };
}

export async function reorderItemStages(
	userId: string,
	input: ReorderInput,
): Promise<SimpleResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	await db.transaction().execute(async (trx) => {
		for (let i = 0; i < input.orderedIds.length; i++) {
			await trx
				.updateTable('order_item_workflow_stages')
				.set({ position: i, updated_at: sql`NOW()` })
				.where('id', '=', input.orderedIds[i])
				.where('store_id', '=', store.id)
				.execute();
		}
	});

	return { ok: true };
}
