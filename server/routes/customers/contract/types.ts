import { z } from 'zod';
import {
	CustomerDetailSchema,
	CustomerEmailParamSchema,
	CustomerTierSchema,
} from './schemas.js';

export type CustomerTier = z.infer<typeof CustomerTierSchema>;
export type CustomerEmailParam = z.infer<typeof CustomerEmailParamSchema>;
export type CustomerDetail = z.infer<typeof CustomerDetailSchema>;
