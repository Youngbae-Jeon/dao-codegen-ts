import path from 'path';
import { ModelDefinition } from '..';

import { Generation } from '../config';
import { DaoClassGenerator } from './DaoClassGenerator';
import { JsCoder } from './JsCoder';
import { ModelAnalyzer } from './ModelAnalyzer';
import { ModelInterfaceGenerator } from './ModelInterfaceGenerator';
import { ModulesCoder } from './ModulesCoder';
import { Table } from './table';
import { upperCamelCase } from './utils';

export class TsGenerator {
	private name: string;
	private table: Table;

	constructor(model: ModelDefinition, private options: Required<Generation>['ts']) {
		const table = new ModelAnalyzer(model, {propertyNameStyle: options?.propertyNameStyle}).analyze();
		this.name = upperCamelCase(`${options.dataTypeName?.prefix || ''}_${table.modelName || table.name}_${options.dataTypeName?.suffix || ''}`);
		this.table = table;
	}

	generate(): { name: string, content: string } {
		const modelDir = path.dirname(this.table.modelFile);
		const modules = new ModulesCoder({baseDir: modelDir, outDir: this.options.output.dir});

		const { name: dataTypeName, code: interfaceCode} = new ModelInterfaceGenerator(this.table, this.options).generate(modules);

		let classCode: JsCoder | undefined = undefined;
		if (!this.options.dataTypeOnly) {
			const result = new DaoClassGenerator(this.table, { dataTypeName, daoClassName: this.options.daoClassName, insertMany: this.options.insertMany }).generate(modules);
			classCode = result.code;
		}

		const coder = new JsCoder();
		this.writeHeader(coder);
		coder.add(modules.getCode());
		coder.add(interfaceCode);
		if (classCode) coder.add(classCode);

		return {
			name: this.name,
			content: coder.toString()
		}
	}

	private resolveModelFilePath() {
		return path.relative(this.options.output.dir, this.table.modelFile);
	}

	private writeHeader(coder: JsCoder) {
		coder.add(`
		// DO NOT EDIT THIS FILE:
		// This file is generated from model file '${this.resolveModelFilePath()}'
		// by dao-codegen-ts
		// --------------------`);
	}

}	