import type { FastifyInstance } from 'fastify';
import {
	handleRegister,
	handleLogin,
	handleDemoLogin,
	handleLogout,
	handleForgotPassword,
	handleResetPassword,
	handleStatus,
	handleOauthSession,
} from './auth-controller.js';

export async function authRoutes(app: FastifyInstance) {
	app.post('/auth/register', handleRegister);
	app.post('/auth/login', handleLogin);
	app.post('/auth/demo', handleDemoLogin);
	app.post('/auth/logout', handleLogout);
	app.post('/auth/forgot-password', handleForgotPassword);
	app.post('/auth/reset-password', handleResetPassword);
	app.post('/auth/oauth/session', handleOauthSession);
	app.get('/auth/status', handleStatus);
}
