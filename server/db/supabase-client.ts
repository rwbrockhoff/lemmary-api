import { createClient } from '@supabase/supabase-js';
import { env } from '../config/environment.js';

export const supabase = createClient(env.SUPABASE_CLIENT, env.SUPABASE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
});

export const supabaseAdmin = createClient(
	env.SUPABASE_CLIENT,
	env.SUPABASE_PRIVATE_KEY,
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	},
);
