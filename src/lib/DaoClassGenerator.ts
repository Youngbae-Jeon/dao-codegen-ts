import { JsCoder } from "./JsCoder";
import { ModulesCoder } from "./ModulesCoder";
import { Column, Table } from "./table";
import { isPrimativeType, upperCamelCase } from "./utils";

export class DaoClassGenerator {
	private name: string;

	constructor(private table: Table, private options?: {dataTypeName: string, daoClassName?: {prefix?: string, suffix?: string}}) {
		this.name = upperCamelCase(`${options?.daoClassName?.prefix || ''}_${table.modelName || table.name}_${options?.daoClassName?.suffix || ''}`);
	}

	generate(modules: ModulesCoder): {name: string, code: JsCoder} {
		const coder = new JsCoder();
		this.writeImports(modules);

		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;
	
		coder.add(`export class ${this.name}Entity {`);

		this.generateHarvestData(coder);
		coder.add('');
		this.generateHarvest(coder);

		coder.add('}');

		if (coder.length()) coder.add('');
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

	private generateHarvestData(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`static harvestData(row: {[name: string]: any}, dest?: any): ${this.options?.dataTypeName}Data {`);
		coder.add(`if (!dest) dest = {};`);
		coder.add('');

		table.columns.filter(column => !primaryKeyColumns.includes(column.name)).forEach(column => this.generateHarvestColumn(column, coder));

		coder.add(`
			return dest;
		}`);
	}

	private generateHarvest(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`static harvest(row: {[name: string]: any}, dest?: any): ${this.options?.dataTypeName} {`);
		coder.add(`if (!dest) dest = {};`);
		coder.add('');

		table.columns.filter(column => primaryKeyColumns.includes(column.name)).forEach(column => this.generateHarvestColumn(column, coder));

		coder.add(`
			this.harvestData(row, dest);
			return dest;
		}`);
	}

	private generateHarvestColumn(column: Column, coder: JsCoder) {
		switch (column.propertyType) {
		case 'boolean':
			coder.add(`if (_.isBoolean(row.${column.name})) dest.${column.propertyName} = row.${column.name};`);
			coder.add(`else if (_.isNumber(row.${column.name})) dest.${column.propertyName} = !!row.${column.name};`);
			break;
		case 'number':
			coder.add(`if (_.isNumber(row.${column.name})) dest.${column.propertyName} = row.${column.name};`);
			break;
		case 'string':
			coder.add(`if (_.isString(row.${column.name})) dest.${column.propertyName} = row.${column.name};`);
			break;
		case 'Date':
			coder.add(`if (_.isDate(row.${column.name})) dest.${column.propertyName} = row.${column.name};`);
			coder.add(`else if (_.isString(row.${column.name})) dest.${column.propertyName} = new Date(row.${column.name});`);
			break;
		default:
			coder.add(`if (_.isString(row.${column.name})) dest.${column.propertyName} = row.${column.name};`);
		}

		coder.add(this.handleNullLikeValues(column));
		coder.add(this.throwUnhandledValues(column));
		coder.add('');
	}

	private handleNullLikeValues(column: Column): string {
		if (column.notNull) {
			return `else if (row.${column.name} === null || row.${column.name} === undefined) throw new Error('row.${column.name} cannot be null');`;
		} else {
			return `else if (row.${column.name} === null || row.${column.name} === undefined) row.${column.propertyName} = null;`;
		}
	}
	private throwUnhandledValues(column: Column): string {
		return `else throw new TypeError('Wrong type for row.${column.name}');`;
	}
}
