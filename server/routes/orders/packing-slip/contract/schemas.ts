import { z } from 'zod';

export const PackingSlipsBodySchema = z.object({
	orderIds: z.array(z.uuid()).min(1),
});
