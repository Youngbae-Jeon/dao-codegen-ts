import { initConfig } from 'config';
import { executeAllGenerations } from './generate';

// USAGE: dao-codegen-ts <config_file>

if (!process.argv[0].match(/\bts-node\b/)) {
	require('source-map-support').install();
}

const config = initConfig(process.argv[2]);
executeAllGenerations(config.generations).catch(err => {
	console.error(err);
	process.exit(-1);
});
