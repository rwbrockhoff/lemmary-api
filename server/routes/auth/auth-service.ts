import { sql } from 'kysely';
import {
	supabase,
	supabaseAdmin,
	createUserClient,
} from '../../db/supabase-client.js';
import { db } from '../../db/connection.js';
import { env } from '../../config/environment.js';
import { DEMO_USER_ID } from '../../config/constants.js';
import {
	getCachedUserId,
	setCachedUserId,
	deleteCachedUserId,
} from '../../utils/session-cache.js';
import type { CurrentUser } from './contract/types.js';
import type {
	RegisterUserParams,
	RegisterUserResult,
	LoginUserParams,
	LoginUserResult,
	ResetPasswordParams,
	ResetPasswordResult,
	ChangePasswordParams,
	ChangeEmailParams,
	ChangeCredentialResult,
	IdentityResult,
	ExchangeOauthSessionParams,
	ExchangeOauthSessionResult,
	AuthenticateResult,
} from './auth-service-types.js';

export async function registerUser({
	email,
	password,
	firstName,
	lastName,
}: RegisterUserParams): Promise<RegisterUserResult> {
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			emailRedirectTo: `${env.FRONTEND_URL}/auth/callback`,
			data: {
				first_name: firstName,
				last_name: lastName,
			},
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
			error:
				"An account with this email already exists. Try signing in, or use 'Sign in with Google'.",
			statusCode: 409,
		};
	}

	try {
		await db
			.insertInto('users')
			.values({
				id: data.user.id,
				email,
				first_name: firstName,
				last_name: lastName,
			})
			.execute();
	} catch (err) {
		// roll back the auth user so the email can be retried
		await supabaseAdmin.auth.admin.deleteUser(data.user.id);
		console.error('Local user insert failed, rolled back auth user', err);
		return { success: false, error: 'Registration failed', statusCode: 500 };
	}

	return {
		success: true,
		userId: data.user.id,
		needsEmailConfirmation: !data.user.email_confirmed_at,
	};
}

export async function loginUser({
	email,
	password,
}: LoginUserParams): Promise<LoginUserResult> {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		const isInvalidCreds = error.message
			.toLowerCase()
			.includes('invalid login credentials');
		const message = isInvalidCreds
			? "Invalid email or password. If you signed up with Google, use 'Sign in with Google'."
			: error.message;
		return { success: false, error: message, statusCode: 401 };
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

export async function getCurrentUser(
	userId: string,
): Promise<CurrentUser | null> {
	const row = await db
		.selectFrom('users')
		.select(['id', 'email', 'first_name', 'last_name', 'avatar_url'])
		.where('id', '=', userId)
		.executeTakeFirst();

	if (!row) return null;

	return {
		userId: row.id,
		email: row.email,
		firstName: row.first_name,
		lastName: row.last_name,
		avatarUrl: row.avatar_url,
		isDemo: row.id === DEMO_USER_ID,
	};
}

export async function requestPasswordReset(email: string): Promise<void> {
	await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${env.FRONTEND_URL}/auth/reset-password`,
	});
}

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

export async function changePassword({
	userId,
	currentPassword,
	newPassword,
}: ChangePasswordParams): Promise<ChangeCredentialResult> {
	const user = await db
		.selectFrom('users')
		.select('email')
		.where('id', '=', userId)
		.executeTakeFirst();

	if (!user) {
		return { success: false, error: 'Account not found', statusCode: 401 };
	}

	const { error: verifyError } = await supabase.auth.signInWithPassword({
		email: user.email,
		password: currentPassword,
	});

	if (verifyError) {
		return {
			success: false,
			error: 'Current password is incorrect',
			statusCode: 401,
		};
	}

	const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
		userId,
		{ password: newPassword },
	);

	if (updateError) {
		return { success: false, error: updateError.message, statusCode: 400 };
	}

	return { success: true };
}

export async function changeEmail({
	userId,
	currentPassword,
	newEmail,
}: ChangeEmailParams): Promise<ChangeCredentialResult> {
	const user = await db
		.selectFrom('users')
		.select('email')
		.where('id', '=', userId)
		.executeTakeFirst();

	if (!user) {
		return { success: false, error: 'Account not found', statusCode: 401 };
	}

	if (newEmail === user.email) {
		return {
			success: false,
			error: 'That is already your email address',
			statusCode: 400,
		};
	}

	const { data, error: verifyError } = await supabase.auth.signInWithPassword({
		email: user.email,
		password: currentPassword,
	});

	if (verifyError || !data.session) {
		return {
			success: false,
			error: 'Current password is incorrect',
			statusCode: 401,
		};
	}

	const userClient = createUserClient();

	// Handle session error
	const { error: sessionError } = await userClient.auth.setSession({
		access_token: data.session.access_token,
		refresh_token: data.session.refresh_token,
	});

	if (sessionError) {
		return {
			success: false,
			error: 'Could not verify your session',
			statusCode: 401,
		};
	}

	const { error: updateError } = await userClient.auth.updateUser(
		{ email: newEmail },
		{ emailRedirectTo: `${env.FRONTEND_URL}/auth/callback` },
	);

	if (updateError) {
		return { success: false, error: updateError.message, statusCode: 400 };
	}

	return { success: true };
}

export async function getUserIdentity(userId: string): Promise<IdentityResult> {
	const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

	if (error || !data.user) {
		return { success: false, error: 'Account not found', statusCode: 401 };
	}

	const { provider, providers } = data.user.app_metadata;
	const providerList = providers ?? (provider ? [provider] : []);

	return {
		success: true,
		hasPassword: providerList.includes('email'),
		providers: providerList,
	};
}

export async function exchangeOauthSession({
	accessToken,
	refreshToken,
}: ExchangeOauthSessionParams): Promise<ExchangeOauthSessionResult> {
	const { data, error } = await supabase.auth.getUser(accessToken);

	if (error || !data.user) {
		return { success: false, error: 'Invalid OAuth session', statusCode: 401 };
	}

	const email = data.user.email;
	if (!email) {
		return {
			success: false,
			error: 'OAuth session missing email',
			statusCode: 401,
		};
	}

	const existing = await db
		.selectFrom('users')
		.select(['id', 'email'])
		.where('id', '=', data.user.id)
		.executeTakeFirst();

	if (existing && existing.email !== email) {
		await db
			.updateTable('users')
			.set({ email, updated_at: sql`NOW()` })
			.where('id', '=', data.user.id)
			.execute();
	}

	if (!existing) {
		const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
		const fullName =
			(metadata.full_name as string | undefined) ??
			(metadata.name as string | undefined) ??
			'';
		const [splitFirst, ...splitRest] = fullName.split(' ');
		const firstName =
			(metadata.given_name as string | undefined) ??
			(metadata.first_name as string | undefined) ??
			splitFirst ??
			null;
		const lastName =
			(metadata.family_name as string | undefined) ??
			(metadata.last_name as string | undefined) ??
			(splitRest.length > 0 ? splitRest.join(' ') : null);
		const avatarUrl =
			(metadata.avatar_url as string | undefined) ??
			(metadata.picture as string | undefined) ??
			null;

		try {
			await db
				.insertInto('users')
				.values({
					id: data.user.id,
					email,
					first_name: firstName,
					last_name: lastName,
					avatar_url: avatarUrl,
				})
				.execute();
		} catch (err) {
			// auth.users row stays; next OAuth retry hits the same code path and re-inserts
			console.error('Local user insert failed on OAuth exchange', err);
			return {
				success: false,
				error: 'Account setup failed, please try again',
				statusCode: 401,
			};
		}
	}

	setCachedUserId(refreshToken, data.user.id);

	return { success: true, userId: data.user.id, email };
}

export async function authenticateRefreshToken(
	refreshToken: string,
): Promise<AuthenticateResult> {
	if (!refreshToken) return { success: false };

	const cachedUserId = getCachedUserId(refreshToken);
	if (cachedUserId) {
		return { success: true, userId: cachedUserId, newRefreshToken: null };
	}

	try {
		const { data, error } = await supabase.auth.refreshSession({
			refresh_token: refreshToken,
		});

		if (error || !data.session?.user?.id) {
			deleteCachedUserId(refreshToken);
			return { success: false };
		}

		const userId = data.session.user.id;
		const newRefreshToken = data.session.refresh_token;

		setCachedUserId(newRefreshToken, userId);

		return {
			success: true,
			userId,
			newRefreshToken:
				newRefreshToken !== refreshToken ? newRefreshToken : null,
		};
	} catch {
		deleteCachedUserId(refreshToken);
		return { success: false };
	}
}
