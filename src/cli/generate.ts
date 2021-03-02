import { Generation, GenerationOutputOptions } from 'config';
import fs from 'fs';
import { GlobSync } from 'glob';
import _ from 'lodash';
import path from 'path';

import { ModelAnalyzer } from '../lib/ModelAnalyzer';
import { SqlGenerator } from '../lib/SqlGenerator';
import { TsGenerator } from '../lib/TsGenerator';
import { loadModel, ModelDefinition } from '../model';

export async function executeAllGenerations(generations: Generation[]): Promise<{ts_files: number, sql_files: number}[]> {
	return Promise.all(generations.map(executeGeneration));
}

export async function executeGeneration(generation: Generation): Promise<{ts_files: number, sql_files: number}> {
	const summary = {ts_files: 0, sql_files: 0};

	const files = listFiles(generation.files);
	for (const file of files) {
		const generated = await executeGenerationForFile(file, generation);
		if (generated.ts_file) ++summary.ts_files;
		if (generated.sql_file) ++summary.sql_files;
	}
	return summary;
}

function listFiles(files: string[]): string[] {
	const resolved: string[] = [];
	files.forEach((file) => resolved.push(...new GlobSync(file).found));
	return _.sortedUniq(resolved);
}

async function executeGenerationForFile(file: string, generation: Pick<Generation, 'ts' | 'sql'>): Promise<{ts_file?: string, sql_file?: string}> {
	const model= await loadModel(file);
	return executeGenerationForModel(model, file, generation);
}

async function executeGenerationForModel(model: ModelDefinition, file: string, generation: Pick<Generation, 'ts' | 'sql'>): Promise<{ts_file?: string, sql_file?: string}> {
	const generated: {ts_file?: string, sql_file?: string} = {};

	const codes = await generateCodes(model, file, generation)
	if (codes.ts) {
		generated.ts_file = writeOutput(codes.ts, generation.ts!.output);
	}
	if (codes.sql) {
		generated.sql_file = writeOutput(codes.sql, generation.sql!.output);
	}
	return generated;
}

type Generated = {name: string, content: string};

export async function generateCodes(model: ModelDefinition, file: string, generation: Pick<Generation, 'ts' | 'sql'>): Promise<{ts?: Generated, sql?: Generated}> {
	const baseDir = path.dirname(file);
	const table = new ModelAnalyzer(model, baseDir).analyze();
	const result: {ts?: Generated, sql?: Generated} = {};

	if (generation.ts) {
		result.ts = new TsGenerator(table, generation.ts).generate();
	}
	if (generation.sql) {
		result.sql = new SqlGenerator(table, generation.sql).generate();
	}
	return result;
}

function writeOutput(generated: Generated, options: GenerationOutputOptions): string {
	const targetPath = path.resolve(options.dir, generated.name);
	fs.writeFileSync(targetPath, generated.content);
	return targetPath;
}
