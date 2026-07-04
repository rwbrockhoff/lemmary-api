import { z } from 'zod';

export const BatchIdParamSchema = z.object({
	batchId: z.uuid(),
});
