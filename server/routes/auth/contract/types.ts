import { z } from 'zod';
import { RegisterRequestSchema, RegisterResponseSchema } from './schemas.js';

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
