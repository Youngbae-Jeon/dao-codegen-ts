import os from 'os';
import fs from 'fs';
import path, { dirname, resolve } from 'path';
import schema from './schema.json';
import yaml from 'yaml';
import Ajv from 'ajv';
import { executeGeneration } from 'cli/generate';

export interface TargetNameOptions {
	prefix?: string;
	suffix?: string;
}

export interface GenerationOutputOptions {
	dir: string;
	prefix?: string;
	suffix?: string;
}

export interface Generation {
	files: string[];
	ts?: {
		dataTypeOnly?: boolean;
		dataTypeName?: TargetNameOptions;
		daoClassName?: TargetNameOptions;
		output: GenerationOutputOptions;
	}
	sql?: {
		tableName?: TargetNameOptions;
		output: GenerationOutputOptions;
	}
}

export interface Config {
	generations: Generation[];
}

const config: Config = {} as any;
export default config;

const DEFAULT_CONFIG_FILENAME = "dao-codegen-ts.yaml";

function getConfigFilepath(filename?: string) {
	if (filename) {
		const filepath = path.resolve(process.cwd(), filename);
		if (!fs.existsSync(filepath)) throw new Error(`No such file: ${filename}`)
		return filepath;

	} else {
		const homeDir = os.homedir();
		filename = DEFAULT_CONFIG_FILENAME;
	
		const candidates = [
			`${process.cwd()}/${filename}`,
			`${homeDir}/.${filename}`,
			`${homeDir}/etc/${filename}`
		];
		const filepath = candidates.find(path => fs.existsSync(path));
		if (!filepath) throw new Error(`Cannot find a file named ${filename}`);
		return filepath;
	}
}

function readConfigFile(dest: {[key: string]: any}, filepath: string) {
    try {
        console.log(`Loading config file ${filepath}`);
        const contents = fs.readFileSync(filepath);
		const config = yaml.parse(contents.toString());
		validateConfig(config);

		Object.assign(dest, config);

    } catch (err) {
        throw new Error(`Error occured while reading config file ${filepath}: ${err.message}`);
    }
}

function validateConfig(config: any) {
    const ajv = new Ajv();
    const ajvValidate = ajv.compile(schema);
    if (!ajvValidate(config)) throw new Error(ajv.errorsText(ajvValidate.errors, {dataVar: 'config'}));
}

function deleteProperties(obj: {[key: string]: any}) {
	for (const key in obj) { delete obj[key]; }
}

function resolveRelativePaths(config: Config, filepath: string) {
	const cwd = process.cwd();
	const baseDir = path.dirname(filepath);
	const relativePath = (filepath: string) => path.relative(cwd, path.resolve(baseDir, filepath));

	config.generations.forEach(generation => {
		generation.files = generation.files.map(relativePath);
		if (generation.ts?.output.dir) {
			generation.ts.output.dir = relativePath(generation.ts.output.dir);
		}
		if (generation.sql?.output.dir) {
			generation.sql.output.dir = relativePath(generation.sql.output.dir);
		}
	});
}

export function initConfig(filename?: string): Config {
	const filepath = getConfigFilepath(filename);

	deleteProperties(config);
	readConfigFile(config, filepath);
	resolveRelativePaths(config, filepath);

	return config;
}
