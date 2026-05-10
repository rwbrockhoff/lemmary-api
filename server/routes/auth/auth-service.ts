import { supabase } from '../../db/supabase-client.js';
import { env } from '../../config/environment.js';

type RegisterUserParams = {
	email: string;
	password: string;
};

type RegisterUserResult =
	| { success: true; userId: string; needsEmailConfirmation: boolean }
	| { success: false; error: string; statusCode: 400 | 409 | 500 };

export async function registerUser({
	email,
	password,
}: RegisterUserParams): Promise<RegisterUserResult> {
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			emailRedirectTo: `${env.FRONTEND_URL}/auth/verify`,
		},
	});

	if (error) {
		return { success: false, error: error.message, statusCode: 400 };
	}

	if (!data.user) {
		return { success: false, error: 'Registration failed', statusCode: 500 };
	}

	// supabase returns empty identities on duplicate email
	const isNewUser = (data.user.identities?.length ?? 0) > 0;
	if (!isNewUser) {
		return {
			success: false,
			error: 'Email already registered',
			statusCode: 409,
		};
	}

	return {
		success: true,
		userId: data.user.id,
		needsEmailConfirmation: !data.user.email_confirmed_at,
	};
}
