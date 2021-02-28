import { JsCoder } from './JsCoder';
import { ModulesCoder } from './ModulesCoder';
import { Table } from './table';
import { isPrimativeType, upperCamelCase } from './utils';

export class InterfaceCodeGenerator {
	private name: string;

	constructor(private table: Table, private options?: {dataTypeName?: {prefix?: string, suffix?: string}}) {
		this.name = upperCamelCase(`${options?.dataTypeName?.prefix || ''}_${table.modelName || table.name}_${options?.dataTypeName?.suffix || ''}`);
	}
	
	generate(modules: ModulesCoder): string[] {
		const js = new JsCoder();
		this.writeImports(modules);

		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;
	
		// interface ~Data
		js.add(`export interface ${this.name}Data {`);
		table.columns.forEach(column => {
			if (!primaryKeyColumns.includes(column.name)) {
				this.writeComment(column, js);
				if (column.notNull) {
					js.add(`${column.propertyName}: ${column.propertyType};`);
				} else {
					js.add(`${column.propertyName}?: ${column.propertyType} | null;`);
				}
			}
		});
		js.add('}');
		js.add('');
	
		// interface
		this.writeComment(table, js);
		js.add(`export interface ${this.name} extends ${this.name}Data {`);
		primaryKeyColumns.forEach(name => {
			const column = table.columns.find(column => column.name === name)!;
			this.writeComment(column, js);
			js.add(`${column.propertyName}: ${column.propertyType};`);
		});
		js.add('}');
		js.add('');

		return js.getLines();
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
