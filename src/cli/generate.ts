import { Generation, GenerationOutputOptions } from 'config';
import fs from 'fs';
import { GlobSync } from 'glob';
import _ from 'lodash';
import path from 'path';

import { InterfaceCodeGenerator } from '../lib/InterfaceCodeGenenerator';
import { ModelAnalyzer } from '../lib/ModelAnalyzer';
import { SqlCodeGenerator } from '../lib/SqlCodeGenerator';
import { TsCodeGenerator } from '../lib/TsCodeGenerator';
import { loadModel, ModelDefinition } from '../model';

export async function executeAllGenerations(generations: Generation[]): Promise<{interface_files: number, dao_files: number, sql_files: number}[]> {
	return Promise.all(generations.map(executeGeneration));
}

export async function executeGeneration(generation: Generation): Promise<{interface_files: number, dao_files: number, sql_files: number}> {
	const summary = {interface_files: 0, dao_files: 0, sql_files: 0};

	const files = listFiles(generation.files);
	for (const file of files) {
		const generated = await executeGenerationForFile(file, generation);
		if (generated.interface_file) ++summary.interface_files;
		if (generated.dao_file) ++summary.dao_files;
		if (generated.sql_file) ++summary.sql_files;
	}
	return summary;
}

function listFiles(files: string[]): string[] {
	const resolved: string[] = [];
	files.forEach((file) => resolved.push(...new GlobSync(file).found));
	return _.sortedUniq(resolved);
}

async function executeGenerationForFile(file: string, generation: Generation): Promise<{interface_file?: string, dao_file?: string, sql_file?: string}> {
	const generated: {interface_file?: string, dao_file?: string, sql_file?: string} = {};

	const model= await loadModel(file);
	const codes = await generateCodes(model, generation)
	if (codes.ts) {
		generated.interface_file = writeOutput(codes.ts, generation.ts!.output);
	}
	if (codes.sql) {
		generated.sql_file = writeOutput(codes.sql, generation.sql!.output);
	}

	return generated;
}

type Generated = {name: string, content: string};

export async function generateCodes(model: ModelDefinition, generation: Generation): Promise<{ts?: Generated, sql?: Generated}> {
	const table = new ModelAnalyzer(model).analyze();
	const result: {ts?: Generated, sql?: Generated} = {};

	if (generation.ts) {
		result.ts = new TsCodeGenerator(table, generation.ts).generate();
	}
	if (generation.sql) {
		result.sql = new SqlCodeGenerator(table, generation.sql).generate();
	}

	return result;
}

function writeOutput(generated: Generated, options: GenerationOutputOptions): string {
	const targetPath = path.resolve(options.dir, generated.name);
	fs.writeFileSync(targetPath, generated.content);
	return targetPath;
}
