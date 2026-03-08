import type { FastifyInstance } from 'fastify';
import {
	handleGetMaterialTypes,
	handleSearchMaterialTypes,
	handleSearchMaterialCatalog,
	handleSearchMaterials,
	handleGetOrCreateMaterial,
	handleGetBomForVariant,
	handleCreateBomItem,
	handleUpdateBomItem,
	handleDeleteBomItem,
	handleGetBomSuggestions,
	handleCopyBomFromVariant,
} from './bom-controller.js';

export async function bomRoutes(app: FastifyInstance) {
	app.get('/bom/material-types', handleGetMaterialTypes);
	app.get('/bom/material-types/search', handleSearchMaterialTypes);
	app.get('/bom/materials/catalog', handleSearchMaterialCatalog);
	app.get('/bom/materials/search', handleSearchMaterials);
	app.post('/bom/materials', handleGetOrCreateMaterial);
	app.get('/bom/suggestions', handleGetBomSuggestions);
	app.get('/bom', handleGetBomForVariant);
	app.post('/bom/copy', handleCopyBomFromVariant);
	app.post('/bom', handleCreateBomItem);
	app.put('/bom/:bomItemId', handleUpdateBomItem);
	app.delete('/bom/:bomItemId', handleDeleteBomItem);
}
