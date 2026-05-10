import { supabase, supabaseAdmin } from '../../db/supabase-client.js';
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

type LoginUserParams = {
	email: string;
	password: string;
};

type LoginUserResult =
	| { success: true; userId: string; email: string; refreshToken: string }
	| { success: false; error: string; statusCode: 401 | 500 };

export async function loginUser({
	email,
	password,
}: LoginUserParams): Promise<LoginUserResult> {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		return { success: false, error: error.message, statusCode: 401 };
	}

	if (!data.session || !data.user) {
		return { success: false, error: 'Login failed', statusCode: 500 };
	}

	return {
		success: true,
		userId: data.user.id,
		email: data.user.email ?? email,
		refreshToken: data.session.refresh_token,
	};
}

export async function requestPasswordReset(email: string): Promise<void> {
	await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${env.FRONTEND_URL}/auth/reset-password`,
	});
}

type ResetPasswordParams = {
	accessToken: string;
	newPassword: string;
};

type ResetPasswordResult =
	| { success: true }
	| { success: false; error: string; statusCode: 400 | 401 };

export async function resetPassword({
	accessToken,
	newPassword,
}: ResetPasswordParams): Promise<ResetPasswordResult> {
	const { data: userData, error: getUserError } =
		await supabase.auth.getUser(accessToken);

	if (getUserError || !userData.user) {
		return {
			success: false,
			error: 'Invalid or expired reset token',
			statusCode: 401,
		};
	}

	const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
		userData.user.id,
		{ password: newPassword },
	);

	if (updateError) {
		return { success: false, error: updateError.message, statusCode: 400 };
	}

	return { success: true };
}
