import { initConfig } from '../config';
import { executeGeneration } from './generate';
import util from 'util';

// USAGE: dao-codegen-ts <config_file>

const config = initConfig(process.argv[2]);
Promise.all(config.generations.map(executeGeneration)).catch(err => {
	console.error(err);
	process.exit(-1);
});
