import { z } from 'zod';
import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';
import type { UpdateWorkflowStageRequestSchema } from './contract/schemas.js';

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

type UpdateWorkflowStageInput = z.infer<
	typeof UpdateWorkflowStageRequestSchema
>;

type UpdateWorkflowStageSuccess = {
	ok: true;
	id: string;
	name: string;
};

type UpdateWorkflowStageError = {
	ok: false;
	error: 'no_store' | 'not_found';
};

type UpdateWorkflowStageResult =
	| UpdateWorkflowStageSuccess
	| UpdateWorkflowStageError;

export async function updateWorkflowStage(
	userId: string,
	stageId: string,
	updates: UpdateWorkflowStageInput,
): Promise<UpdateWorkflowStageResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	const updated = await db
		.updateTable('order_workflow_stages')
		.set({ name: updates.name, updated_at: new Date() })
		.where('id', '=', stageId)
		.where('store_id', '=', store.id)
		.returning(['id', 'name'])
		.executeTakeFirst();

	if (!updated) return { ok: false, error: 'not_found' };

	return { ok: true, id: updated.id, name: updated.name };
}
