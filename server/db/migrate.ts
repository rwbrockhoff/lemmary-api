import { env } from '../config/environment.js';
import * as path from 'path';
import pg from 'pg';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import {
	Kysely,
	Migrator,
	PostgresDialect,
	FileMigrationProvider,
	NO_MIGRATIONS,
} from 'kysely';

function createMigrator() {
	const db = new Kysely<any>({
		dialect: new PostgresDialect({
			pool: new pg.Pool({
				connectionString: env.DATABASE_URL,
			}),
		}),
	});

	const __dirname = path.dirname(fileURLToPath(import.meta.url));

	const migrator = new Migrator({
		db,
		provider: new FileMigrationProvider({
			fs,
			path,
			migrationFolder: path.join(__dirname, 'migrations'),
		}),
	});

	return { db, migrator };
}

async function migrateToLatest() {
	const { db, migrator } = createMigrator();
	const { error, results } = await migrator.migrateToLatest();

	results?.forEach((it) => {
		if (it.status === 'Success') {
			console.log(`  migrated: ${it.migrationName}`);
		} else if (it.status === 'Error') {
			console.error(`  failed:   ${it.migrationName}`);
		}
	});

	if (error) {
		console.error('Migration failed');
		console.error(error);
		process.exit(1);
	}

	if (!results?.length) {
		console.log('No pending migrations');
	}

	await db.destroy();
}

async function migrateDown(all = false) {
	const { db, migrator } = createMigrator();
	const { error, results } = all
		? await migrator.migrateTo(NO_MIGRATIONS)
		: await migrator.migrateDown();

	results?.forEach((it) => {
		if (it.status === 'Success') {
			console.log(`  reverted: ${it.migrationName}`);
		} else if (it.status === 'Error') {
			console.error(`  failed:   ${it.migrationName}`);
		}
	});

	if (error) {
		console.error('Rollback failed');
		console.error(error);
		process.exit(1);
	}

	await db.destroy();
}

const command = process.argv[2];

if (command === 'down:all') {
	migrateDown(true);
} else if (command === 'down') {
	migrateDown();
} else {
	migrateToLatest();
}
