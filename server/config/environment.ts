import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
	PORT: z.coerce.number().default(3001),
	FRONTEND_URL: z.string().default('http://localhost:5173'),
	DATABASE_URL: z.string().min(1),
	SQUARESPACE_API_KEY: z.string().min(1),
	NODE_ENV: z.string().default('development'),
	COOKIE_SECRET: z.string().min(32),
	SUPABASE_CLIENT: z.url(),
	SUPABASE_KEY: z.string().min(1),
	SUPABASE_PRIVATE_KEY: z.string().min(1),
});

type Environment = z.infer<typeof envSchema>;

export function validateEnvironment(): Environment {
	try {
		return envSchema.parse(process.env);
	} catch (error) {
		console.error('ENV validation failed — server cannot start');

		if (error instanceof z.ZodError) {
			for (const issue of error.issues) {
				console.error(`  ${issue.path.join('.')}: ${issue.message}`);
			}
		}

		process.exit(1);
	}
}

export const env = validateEnvironment();
