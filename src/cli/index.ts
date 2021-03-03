import { initConfig } from 'config';
import { executeGeneration } from './generate';

// USAGE: dao-codegen-ts <config_file>

if (!process.argv[0].match(/\bts-node\b/)) {
	require('source-map-support').install();
}

const config = initConfig(process.argv[2]);

Promise.all(config.generations.map(executeGeneration)).catch(err => {
	console.error(err);
	process.exit(-1);
});
