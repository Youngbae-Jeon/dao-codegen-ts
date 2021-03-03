import { Generation, GenerationOutputOptions } from 'config';
import fs from 'fs';
import { GlobSync } from 'glob';
import _ from 'lodash';
import path from 'path';

import { ModelAnalyzer } from '../lib/ModelAnalyzer';
import { SqlGenerator } from '../lib/SqlGenerator';
import { TsGenerator } from '../lib/TsGenerator';
import { loadModel, ModelDefinition } from '../model';

export async function executeGeneration(generation: Generation): Promise<{ts_files: string[], sql_files: string[]}> {
	const acc = {ts_files: [] as string[], sql_files: [] as string[]};

	const files = listFiles(generation.files);
	for (const file of files) {
		const generated = await executeGenerationForFile(file, generation);

		if (generated.ts_file) acc.ts_files.push(generated.ts_file);
		if (generated.sql_file) acc.sql_files.push(generated.sql_file);
	}
	return acc;
}

function listFiles(files: string[]): string[] {
	const resolved: string[] = [];
	files.forEach((file) => resolved.push(...new GlobSync(file).found));
	return _.sortedUniq(resolved);
}

async function executeGenerationForFile(file: string, generation: Pick<Generation, 'ts' | 'sql'>): Promise<{ts_file?: string, sql_file?: string}> {
	const model= await loadModel(file);

	const generated: {ts_file?: string, sql_file?: string} = {};
	const codes = await generateCodes(model, file, generation)
	if (codes.ts) {
		const output = { ...generation.ts!.output };
		if (!output.suffix) output.suffix = '.ts';
		generated.ts_file = writeOutput(codes.ts, output);
	}
	if (codes.sql) {
		const output = { ...generation.sql!.output };
		if (!output.suffix) output.suffix = '.sql';
		generated.sql_file = writeOutput(codes.sql, output);
	}
	return generated;
}

type Generated = {name: string, content: string};

async function generateCodes(model: ModelDefinition, file: string, generation: Pick<Generation, 'ts' | 'sql'>): Promise<{ts?: Generated, sql?: Generated}> {
	const table = new ModelAnalyzer(model, file).analyze();
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
	const filename = `${options.prefix || ''}${generated.name}${options.suffix || ''}`;
	const targetPath = path.resolve(options.dir, filename);
	fs.mkdirSync(path.dirname(targetPath), {recursive: true});
	fs.writeFileSync(targetPath, generated.content);
	return targetPath;
}
