import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
	validatorCompiler,
	serializerCompiler,
	jsonSchemaTransform,
} from 'fastify-type-provider-zod';
import { openApiMetadata } from './metadata.js';

export const registerOpenApi = (app: FastifyInstance) => {
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	app.register(swagger, {
		openapi: openApiMetadata,
		transform: jsonSchemaTransform,
	});

	app.register(swaggerUi, {
		routePrefix: '/api-docs',
	});
};
