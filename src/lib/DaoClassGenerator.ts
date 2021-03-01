import _ from "lodash";
import { JsCoder } from "./JsCoder";
import { ModulesCoder } from "./ModulesCoder";
import { Column, Table } from "./table";
import { isPrimativeType, upperCamelCase } from "./utils";

export class DaoClassGenerator {
	private name: string;

	constructor(private table: Table, private options: {dataTypeName: string, daoClassName?: {prefix?: string, suffix?: string}}) {
		const prefix = _.isString(options.daoClassName?.prefix) ? options.daoClassName?.prefix: '';
		const suffix = _.isString(options.daoClassName?.suffix) ? options.daoClassName?.suffix : 'Dao';
		this.name = upperCamelCase(`${prefix}_${table.modelName || table.name}_${suffix}`);
	}

	generate(modules: ModulesCoder): {name: string, code: JsCoder} {
		const coder = new JsCoder();
		this.writeImports(modules);

		coder.add(`export class ${this.name} {`);
		this.generateHarvestData(coder);
		coder.add('');
		this.generateHarvest(coder);
		coder.add('');
		this.generateFind(coder);
		coder.add('');
		this.generateFindBy(coder);
		coder.add('');
		this.generateFetch(coder);
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

		mc.importDefault('_', 'lodash');
		mc.import('Connection', 'mysql2/promise');
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

		coder.add(`static harvestData(row: {[name: string]: any}, dest?: any): ${this.options.dataTypeName}Data {`);
		coder.add(`if (!dest) dest = {};`);
		coder.add('');

		table.columns.filter(column => !primaryKeyColumns.find(pkcolumn => pkcolumn.name === column.name)).forEach(column => this.generateHarvestColumn(column, coder));

		coder.add(`
			return dest;
		}`);
	}

	private generateHarvest(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`static harvest(row: {[name: string]: any}, dest?: any): ${this.options.dataTypeName} {`);
		coder.add(`if (!dest) dest = {};`);
		coder.add('');

		table.columns.filter(column => primaryKeyColumns.find(pkcolumn => pkcolumn.name === column.name)).forEach(column => this.generateHarvestColumn(column, coder));

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

	private generateFind(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`
		static async find(${primaryKeyColumns.map(pkcolumn => `${pkcolumn.propertyName}: ${pkcolumn.propertyType}`).join(', ')}, conn: Connection, options?: {for?: 'update'}): Promise<${this.options.dataTypeName} | undefined> {
			let sql = 'SELECT * FROM ${table.name} WHERE ${primaryKeyColumns.map(pkcolumn => `${pkcolumn.name}=?`).join(' AND ')}';
			if (options?.for === 'update') sql += ' FOR UPDATE';

			const rows = await conn.query(sql, [${primaryKeyColumns.map(p => p.propertyName).join(', ')}]);
			if (rows.length) {
				return this.harvest(row[0]);
			}
		}`);
	}

	private generateFindBy(coder: JsCoder) {
		coder.add(`
		static async findAllBy(by: Partial<${this.options.dataTypeName}>, conn: Connection): Promise<${this.options.dataTypeName}[]> {
			const wheres: string[] = [];
			const params: any[] = [];
			const keys = Object.keys(by);
			for (const key of keys) {
				const val = (by as any)[key];
				if (val === undefined || val === null) {
					wheres.push(\`\${key} IS NULL\`);
				} else {
					wheres.push(\`\${key}=?\`);
					params.push(val);
				}
			}

			const rows = await conn.query(\`SELECT * FROM ${this.table.name} WHERE \${wheres.join(' AND ')}\`, params);
			return rows.map(row => this.harvest(row));
		}`);
	}

	private generateFetch(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`
		static async fetch(${primaryKeyColumns.map(p => `${p.propertyName}: ${p.propertyType}`).join(', ')}, conn: Connection, options?: {for?: 'update'}): Promise<${this.options.dataTypeName} | undefined> {
			const found = await this.find(${primaryKeyColumns.map(p => p.propertyName).join(', ')}, conn, options);
			if (!found) throw new Error(\`No such #${this.options.dataTypeName}{${primaryKeyColumns.map(p => p.propertyName + ': ${' + p.propertyName + '}').join(', ')}}\`);
			return found;
		}`);
	}
}
