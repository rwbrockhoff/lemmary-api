import { z } from 'zod';
import {
	RegisterRequestSchema,
	RegisterResponseSchema,
	LoginRequestSchema,
	LoginResponseSchema,
} from './schemas.js';

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
