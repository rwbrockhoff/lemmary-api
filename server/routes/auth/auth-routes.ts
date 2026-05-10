import type { FastifyInstance } from 'fastify';
import {
	handleRegister,
	handleLogin,
	handleLogout,
	handleForgotPassword,
	handleResetPassword,
	handleStatus,
} from './auth-controller.js';

export async function authRoutes(app: FastifyInstance) {
	app.post('/auth/register', handleRegister);
	app.post('/auth/login', handleLogin);
	app.post('/auth/logout', handleLogout);
	app.post('/auth/forgot-password', handleForgotPassword);
	app.post('/auth/reset-password', handleResetPassword);
	app.get('/auth/status', handleStatus);
}
