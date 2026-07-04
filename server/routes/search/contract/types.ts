import { z } from 'zod';
import { SearchQuerySchema } from './schemas.js';

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
