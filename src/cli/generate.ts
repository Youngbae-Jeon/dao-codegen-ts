import { Generation, GenerationOutputOptions } from 'config';
import fs from 'fs';
import { GlobSync } from 'glob';
import _ from 'lodash';
import path from 'path';

import { SqlGenerator } from '../lib/SqlGenerator';
import { TsGenerator } from '../lib/TsGenerator';
import { loadModels } from '../model';

export async function executeGeneration(generation: Generation): Promise<{ts_files: string[], sql_files: string[]}> {
	const models = await loadModelFiles(generation.files);

	const acc = {ts_files: [] as string[], sql_files: [] as string[]};
	for (const model of models) {
		if (generation.ts) {
			const generated = new TsGenerator(model, generation.ts).generate();
			const output = generation.ts.output;
			const filename = `${output.prefix || ''}${generated.name}${output.suffix ?? '.ts'}`;
			const ts_file = writeOutput(filename, [generated.content], output);
			acc.ts_files.push(ts_file);
		}

		if (generation.sql) {
			const generated = new SqlGenerator(model, generation.sql).generate();
			const output = generation.sql.output;
			const filename = `${output.prefix || ''}${generated.name}${output.suffix ?? '.sql'}`;
			const sql_file = writeOutput(filename, generated.statements, output);
			acc.sql_files.push(sql_file);
		}
	}
	return acc;
}

export function loadModelFiles(patterns: string[], options?: {orderByDependency?: boolean}) {
	const files = listModelFiles(patterns);
	return loadModels(files);
}

function listModelFiles(patterns: string[]): string[] {
	const resolved = patterns.reduce((resolved, file) => {
		const founds = new GlobSync(file).found;
		if (!founds.length) throw new Error(`No files found maching with ${file}`);
		resolved.push(...founds);
		return resolved;
	}, [] as string[]);
	return _.sortedUniq(resolved);
}

function writeOutput(filename: string,  contents: string[], options: GenerationOutputOptions): string {
	const targetPath = path.resolve(options.dir, filename);
	fs.mkdirSync(path.dirname(targetPath), {recursive: true});
	fs.writeFileSync(targetPath, contents.join('\n'));
	return targetPath;
}
