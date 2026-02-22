import Fastify from 'fastify';

export const buildApp = () => {
	const app = Fastify({ logger: true });

	app.get('/health', async () => {
		return { status: 'ok' };
	});

	return app;
};
