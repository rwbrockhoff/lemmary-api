import { z } from 'zod';
import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';
import type { UpdateWorkflowStageRequestSchema } from './contract/schemas.js';

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
