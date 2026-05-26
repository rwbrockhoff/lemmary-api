import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
	validatorCompiler,
	jsonSchemaTransform,
} from 'fastify-type-provider-zod';
import { openApiMetadata } from './metadata.js';
import { createResponseSerializer } from './response-serializer.js';

const redocPage = `<!DOCTYPE html>
<html>
	<head>
		<title>Lemmary API Documentation</title>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<style>body { margin: 0; padding: 0; }</style>
	</head>
	<body>
		<redoc spec-url="/api-docs/json"></redoc>
		<script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
	</body>
</html>`;

export const registerOpenApi = (app: FastifyInstance) => {
	app.setValidatorCompiler(validatorCompiler);
	// Swap in our serializer so schema'd responses get soft-validated against their contract
	app.setSerializerCompiler(createResponseSerializer(app.log));

	app.register(swagger, {
		openapi: openApiMetadata,
		transform: jsonSchemaTransform,
	});

	app.register(swaggerUi, {
		routePrefix: '/api-docs',
	});

	app.get('/docs', (_request, reply) => {
		reply.type('text/html').send(redocPage);
	});
};
