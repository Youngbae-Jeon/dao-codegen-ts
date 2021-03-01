import { JsCoder } from './JsCoder';
import { ModulesCoder } from './ModulesCoder';
import { Table } from './table';
import { isPrimativeType, upperCamelCase } from './utils';

export class ModelInterfaceGenerator {
	private name: string;

	constructor(private table: Table, private options?: {dataTypeName?: {prefix?: string, suffix?: string}}) {
		this.name = upperCamelCase(`${options?.dataTypeName?.prefix || ''}_${table.modelName || table.name}_${options?.dataTypeName?.suffix || ''}`);
	}
	
	generate(modules: ModulesCoder): {name: string, code: JsCoder} {
		const coder = new JsCoder();
		this.writeImports(modules);

		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;
	
		// interface ~Data
		coder.add(`export interface ${this.name}Data {`);
		table.columns.forEach(column => {
			if (!primaryKeyColumns.includes(column.name)) {
				this.writeComment(column, coder);
				if (column.notNull) {
					coder.add(`${column.propertyName}: ${column.propertyType};`);
				} else {
					coder.add(`${column.propertyName}?: ${column.propertyType} | null;`);
				}
			}
		});
		coder.add('}');
		coder.add('');
	
		// interface
		this.writeComment(table, coder);
		coder.add(`export interface ${this.name} extends ${this.name}Data {`);
		primaryKeyColumns.forEach(name => {
			const column = table.columns.find(column => column.name === name)!;
			this.writeComment(column, coder);
			coder.add(`${column.propertyName}: ${column.propertyType};`);
		});
		coder.add('}');
		coder.add('');

		return { name: this.name, code: coder };
	}

	private writeImports(mc: ModulesCoder) {
		for (const column of this.table.columns) {
			const types = column.propertyType.split(/[^a-zA-Z0-9_\.]+/);
			for (let type of types) {
				const dotPosition = type.indexOf('.');
				if (dotPosition >= 0) {
					type = type.substring(0, dotPosition);
				} 
	
				if (!isPrimativeType(type)) {
					const module = this.findModuleFor(type);
					if (!module) throw new Error(`Cannot resolve non-primative type '${type}'`);

					mc.import(type, module);
				}
			}
		}
	}

	private findModuleFor(type: string): string | undefined {
		const imports = this.table.imports;
		if (imports) {
			return Object.keys(imports).find((module) => {
				const types = imports[module];
				if (types.includes(type)) return module;
			});
		}
	}

	private writeComment(object: {title?: string, description?: string}, js: JsCoder) {
		const lines: string[] = [];
		if (object.title) lines.push(object.title);
		if (object.description) {
			lines.push(...object.description.split('\n'));
		}
		this.writeCommentLines(lines, js);
	}
	
	private writeCommentLines(lines: string[], js: JsCoder) {
		if (lines.length === 1) {
			js.add(`/** ${lines[0]} */`);
		} else if (lines.length > 1) {
			js.add('/**');
			lines.forEach(line => js.add(` * ${line}`));
			js.add(' */');
		}
	}
}
