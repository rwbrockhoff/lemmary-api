export type RegisterUserParams = {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
};

export type RegisterUserResult =
	| { success: true; userId: string; needsEmailConfirmation: boolean }
	| { success: false; error: string; statusCode: 400 | 409 | 500 };

export type LoginUserParams = {
	email: string;
	password: string;
};

export type LoginUserResult =
	| { success: true; userId: string; email: string; refreshToken: string }
	| { success: false; error: string; statusCode: 401 | 500 };

export type ResetPasswordParams = {
	accessToken: string;
	newPassword: string;
};

export type ResetPasswordResult =
	| { success: true }
	| { success: false; error: string; statusCode: 400 | 401 };

export type ChangePasswordParams = {
	userId: string;
	currentPassword: string;
	newPassword: string;
};

export type ChangeEmailParams = {
	userId: string;
	currentPassword: string;
	newEmail: string;
};

export type ChangeCredentialResult =
	| { success: true }
	| { success: false; error: string; statusCode: 400 | 401 };

export type IdentityResult =
	| { success: true; hasPassword: boolean; providers: string[] }
	| { success: false; error: string; statusCode: 401 };

export type ExchangeOauthSessionParams = {
	accessToken: string;
	refreshToken: string;
};

export type ExchangeOauthSessionResult =
	| { success: true; userId: string; email: string }
	| { success: false; error: string; statusCode: 401 };

export type AuthenticateResult =
	| { success: true; userId: string; newRefreshToken: string | null }
	| { success: false };
