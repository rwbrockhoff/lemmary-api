import dotenv from 'dotenv';
import { z } from 'zod';

function resolveEnvFile(nodeEnv: string | undefined): string {
	if (nodeEnv === 'test') return '.env.test';
	if (nodeEnv === 'production') return '.env.production';
	return '.env';
}

dotenv.config({ path: resolveEnvFile(process.env.NODE_ENV) });

const envSchema = z.object({
	PORT: z.coerce.number().default(3001),
	FRONTEND_URL: z.string().default('http://localhost:5173'),
	DATABASE_URL: z.string().min(1),
	SQUARESPACE_API_KEY: z.string().min(1),
	SQUARESPACE_STORE_URL: z.url().optional(),
	STORE_ENCRYPTION_KEY: z.string().min(32),
	API_URL: z.string().default('http://localhost:3001'),
	NODE_ENV: z.string().default('development'),
	COOKIE_SECRET: z.string().min(32),
	SUPABASE_CLIENT: z.url(),
	SUPABASE_KEY: z.string().min(1),
	SUPABASE_PRIVATE_KEY: z.string().min(1),
	DEV_USER_ID: z.uuid(),
	DEV_STORE_ID: z.uuid(),
	DEMO_USER_ID: z.uuid(),
	DEMO_STORE_ID: z.uuid(),
	TEST_USER_ID: z.uuid().optional(),
	TEST_STORE_ID: z.uuid().optional(),
	SENTRY_DSN: z.url().optional(),
	STRIPE_SECRET_KEY: z.string().optional(),
	STRIPE_WEBHOOK_SECRET: z.string().optional(),
	STRIPE_MONTHLY_PRICE_ID: z.string().optional(),
	SHOPIFY_CLIENT_ID: z.string().optional(),
	SHOPIFY_CLIENT_SECRET: z.string().optional(),
	SHOPIFY_INSTALL_URL: z.string().optional(),
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
