import _ from "lodash";
import { JsCoder } from "./JsCoder";
import { ModulesCoder } from "./ModulesCoder";
import { Column, Table } from "./table";
import { TypeExpression } from "./TypeExpression";
import { isKnownGenericType, isPrimativeType, upperCamelCase } from "./utils";

export class DaoClassGenerator {
	private name: string;
	private dataTypeName: string;

	constructor(private table: Table, options: {dataTypeName: string, daoClassName?: {prefix?: string, suffix?: string}}) {
		const prefix = _.isString(options.daoClassName?.prefix) ? options.daoClassName?.prefix: '';
		const suffix = _.isString(options.daoClassName?.suffix) ? options.daoClassName?.suffix : 'Dao';
		this.name = upperCamelCase(`${prefix}_${table.modelName || table.name}_${suffix}`);
		this.dataTypeName = options.dataTypeName;
	}

	generate(modules: ModulesCoder): {name: string, code: JsCoder} {
		const coder = new JsCoder();
		this.writeImports(modules);

		coder.add(`export class ${this.name} {`);
		this.generateStaticHarvestData(coder);
		coder.add('');
		this.generateStaticHarvest(coder);
		coder.add('');
		this.generateStaticFind(coder);
		coder.add('');
		this.generateStaticFilter(coder);
		coder.add('');
		this.generateStaticFetch(coder);
		coder.add('');
		this.generateStaticCreate(coder);
		coder.add('');
		this.generateStaticUpdate(coder);
		coder.add('');
		this.generateStaticDelete(coder);
		coder.add('}');

		if (coder.length()) coder.add('');
		return { name: this.name, code: coder };
	}

	private writeImports(mc: ModulesCoder) {
		this.table.columns.forEach(column => {
			TypeExpression.parse(column.propertyType, (type) => {
				if (isPrimativeType(type)) return;
				if (isKnownGenericType(type)) return;
	
				const module = this.findModuleFor(type);
				if (!module) throw new Error(`Cannot resolve non-primative type '${type}'`);
	
				mc.import(type, module);
			});

			if (column.propertyConverter) {
				const module = this.findModuleFor(column.propertyConverter);
				if (!module) throw new Error(`Cannot resolve property type converter '${column.propertyConverter}'`);

				mc.import(column.propertyConverter, module);
			}
		});

		mc.importDefault('_', 'lodash');
		mc.importDefault('assert', 'assert');
		mc.importDefault('mysql', 'mysql2/promise');
		mc.import(['Connection', 'RowDataPacket', 'ResultSetHeader'], 'mysql2/promise');
	}

	protected findModuleFor(type: string): string | undefined {
		const imports = this.table.imports;
		if (imports) {
			return Object.keys(imports).find((module) => {
				const types = imports[module];
				if (types.includes(type)) return module;
			});
		}
	}

	private generateStaticHarvestData(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`static harvestData(row: {[name: string]: any}, dest?: any): ${this.dataTypeName}Data {`);
		coder.add(`if (!dest) dest = {};`);
		coder.add('');

		table.columns.filter(column => !primaryKeyColumns.find(pkcolumn => pkcolumn.name === column.name)).forEach(column => this.generateHarvestColumn(column, coder));

		coder.add(`
			return dest;
		}`);
	}

	private generateStaticHarvest(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`static harvest(row: {[name: string]: any}, dest?: any): ${this.dataTypeName} {`);
		coder.add(`if (!dest) dest = {};`);
		coder.add('');

		table.columns.filter(column => primaryKeyColumns.find(pkcolumn => pkcolumn.name === column.name)).forEach(column => this.generateHarvestColumn(column, coder));

		coder.add(`
			this.harvestData(row, dest);
			return dest;
		}`);
	}

	private generateHarvestColumn(column: Column, coder: JsCoder) {
		if (column.propertyConverter) {
			coder.add(this.handleNullLikeValues(column));
			coder.add(`else dest.${column.propertyName} = ${column.propertyConverter}.toPropertyValue(row.${column.name});`);

		} else {
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
				if (column.checkingType === 'number') {
					coder.add(`if (_.isNumber(row.${column.name})) dest.${column.propertyName} = row.${column.name};`);
				} else if (column.checkingType === 'any') {
					coder.add(this.handleNullLikeValues(column));
					coder.add(`else dest.${column.propertyName} = row.${column.name};`);
					coder.add('');
					return;
				} else {
					coder.add(`if (_.isString(row.${column.name})) dest.${column.propertyName} = row.${column.name};`);
				}
			}
	
			coder.add(`else ${this.handleNullLikeValues(column)}`);
			coder.add(`else ${this.throwUnhandledValues(column)}`);
		}
		coder.add('');
	}

	private handleNullLikeValues(column: Column): string {
		if (column.notNull) {
			return `if (row.${column.name} === null || row.${column.name} === undefined) throw new Error('row.${column.name} cannot be null');`;
		} else {
			return `if (row.${column.name} === null || row.${column.name} === undefined) dest.${column.propertyName} = null;`;
		}
	}

	private throwUnhandledValues(column: Column): string {
		return `throw new TypeError('Wrong type for row.${column.name}');`;
	}

	private generateStaticFind(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;
		const pkargs = primaryKeyColumns.map(pkcolumn => `${pkcolumn.propertyName}: ${pkcolumn.propertyType}`).join(', ');
		coder.add(`
		static async find(${pkargs}, conn: Pick<Connection, 'execute'>, options?: {for?: 'update'}): Promise<${this.dataTypeName} | undefined> {
			let sql = 'SELECT * FROM ${table.name} WHERE ${primaryKeyColumns.map(pkcolumn => `${pkcolumn.name}=?`).join(' AND ')}';
			if (options?.for === 'update') sql += ' FOR UPDATE';

			const stmt = mysql.format(sql, [${primaryKeyColumns.map(p => p.propertyName).join(', ')}]);
			console.log('${this.name}:', stmt);

			const [rows] = await conn.execute<RowDataPacket[]>(stmt);
			if (rows.length) {
				return this.harvest(rows[0]);
			}
		}`);
	}

	private generateStaticFilter(coder: JsCoder) {
		coder.add(`
		static async filter(by: Partial<${this.dataTypeName}>, conn: Pick<Connection, 'execute'>): Promise<${this.dataTypeName}[]> {
			const wheres: string[] = [];
			const params: any[] = [];
			const keys = Object.keys(by);
			for (const key of keys) {
				const val = (by as any)[key];
				if (val === undefined || val === null) {
					wheres.push(\`\${key} IS NULL\`);
				} else {
					wheres.push(\`\${key}=?\`);
		`);
		const columnsWithConverter = this.table.columns.filter(column => !!column.propertyConverter);
		if (columnsWithConverter.length) {
			columnsWithConverter.forEach((column, i) => {
				coder.add(`${i ? 'else ' : ''}if (key === '${column.propertyName}') params.push(${column.propertyConverter}.toSqlValue(val));`);
			});
			coder.add('else params.push(val);');

		} else {
			coder.add('params.push(val);');
		}
		coder.add(`
				}
			}

			let stmt = mysql.format(\`SELECT * FROM ${this.table.name}\`, params);
			if (wheres.length) stmt += \` WHERE \${wheres.join(' AND ')}\`;
			console.log('${this.name}:', stmt);

			const [rows] = await conn.execute<RowDataPacket[]>(stmt);
			return rows.map(row => this.harvest(row));
		}`);
	}

	private generateStaticFetch(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;
		const pkargs = primaryKeyColumns.map(pkcolumn => `${pkcolumn.propertyName}: ${pkcolumn.propertyType}`).join(', ');
		coder.add(`
		static async fetch(${pkargs}, conn: Pick<Connection, 'execute'>, options?: {for?: 'update'}): Promise<${this.dataTypeName} | undefined> {
			const found = await this.find(${primaryKeyColumns.map(p => p.propertyName).join(', ')}, conn, options);
			if (!found) throw new Error(\`No such #${this.dataTypeName}{${primaryKeyColumns.map(p => p.propertyName + ': ${' + p.propertyName + '}').join(', ')}}\`);
			return found;
		}`);
	}

	private generateStaticCreate(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		if (primaryKeyColumns.length === 1 && primaryKeyColumns[0].autoIncrement) {
			coder.add(`static async create(data: ${this.dataTypeName}Data, conn: Pick<Connection, 'execute'>): Promise<${this.dataTypeName}> {`);
		} else {
			const pkargs = primaryKeyColumns.map(pkcolumn => `${pkcolumn.propertyName}: ${pkcolumn.propertyType}`).join(', ');
			coder.add(`static async create(${pkargs}, data: ${this.dataTypeName}Data, conn: Pick<Connection, 'execute'>, options: { onDuplicate?: 'update' }): Promise<${this.dataTypeName}> {`);
			primaryKeyColumns.forEach(pkcolumn => {
				coder.add(`if (${pkcolumn.propertyName} === null || ${pkcolumn.propertyName} === undefined) throw new Error('Argument ${pkcolumn.propertyName} cannot be null or undefined');`);
			});
			coder.add('');
		}

		coder.add(`const params: {[name: string]: any} = {};`);
		table.columns.filter(column => !column.primaryKey).forEach(column => {
			if (column.notNull) {
				coder.add(`if (data.${column.propertyName} === null || data.${column.propertyName} === undefined) throw new Error('data.${column.propertyName} cannot be null or undefined');`);
			} else {
				coder.add(`if (data.${column.propertyName} === null || data.${column.propertyName} === undefined) params.${column.name} = null;`);
			}
			if (column.propertyConverter) {
				coder.add(`else params.${column.name} = ${column.propertyConverter}.toSqlValue(data.${column.propertyName});`)
			} else {
				if (column.type === 'JSON') {
					coder.add(`else params.${column.name} = JSON.stringify(data.${column.propertyName});`);
				} else {
					coder.add(`else params.${column.name} = data.${column.propertyName};`);
				}
			}
			coder.add('');
		});

		if (primaryKeyColumns.length === 1 && primaryKeyColumns[0].autoIncrement) {
			coder.add(`
			const stmt = mysql.format('INSERT INTO ${table.name} SET ?', [params]);
			console.log('${this.name}:', stmt);

			const [result] = await conn.execute<ResultSetHeader>(stmt);
			const ${primaryKeyColumns[0].propertyName} = result.insertId;
			`);

		} else {
			coder.add(`
			let stmt: string;
			if (options?.onDuplicate === 'update') {
				stmt = mysql.format('INSERT INTO ${table.name} SET ${primaryKeyColumns.map(pkcolumn => pkcolumn.name).join(', ')}, ? ON DUPLICATE KEY UPDATE ?', [${primaryKeyColumns.map(pkcolumn => pkcolumn.propertyName).join(', ')}, params, params]);
			} else {
				stmt = mysql.format('INSERT INTO ${table.name} SET ${primaryKeyColumns.map(pkcolumn => pkcolumn.name).join(', ')}, ?', [${primaryKeyColumns.map(pkcolumn => pkcolumn.propertyName).join(', ')}, params]);
			}
			console.log('${this.name}:', stmt);

			await conn.execute<ResultSetHeader>(stmt);
			`);
		}
		coder.add(`
			return {...data, ${primaryKeyColumns.map(pkcolumn => pkcolumn.propertyName).join(', ')}};
		}`);
	}

	private generateStaticUpdate(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`static async update(origin: ${this.dataTypeName}, data: Partial<${this.dataTypeName}Data>, conn: Pick<Connection, 'execute'>): Promise<${this.dataTypeName}> {`);
		primaryKeyColumns.forEach(pkcolumn => {
			coder.add(`if (origin.${pkcolumn.propertyName} === null || origin.${pkcolumn.propertyName} === undefined) throw new Error('Argument origin.${pkcolumn.propertyName} cannot be null or undefined');`);
		});
		coder.add('');

		coder.add(`
			const params: {[name: string]: any} = {};
			const updates: Partial<${this.dataTypeName}Data> = {};
		`);
		table.columns.filter(column => !column.primaryKey).forEach(column => {
			coder.add(`if (data.${column.propertyName} !== undefined) {`);
			if (column.notNull) {
				coder.add(`if (data.${column.propertyName} === null) throw new Error('data.${column.propertyName} cannot be null or undefined');`);
			}
			if (column.propertyConverter) {
				coder.add(`params.${column.name} = ${column.propertyConverter}.toSqlValue(data.${column.propertyName});`);
			} else {
				if (column.type === 'JSON') {
					coder.add(`params.${column.name} = JSON.stringify(data.${column.propertyName});`);
				} else {
					coder.add(`params.${column.name} = data.${column.propertyName};`);
				}
			}
			coder.add(`updates.${column.propertyName} = data.${column.propertyName};`);
			coder.add('}');
		});
		coder.add('');

		coder.add(`
			const stmt = mysql.format(
				\`UPDATE ${table.name} SET ? WHERE ${primaryKeyColumns.map(pkcolumn => pkcolumn.name + '=?').join(' AND ')}\`,
				[params, ${primaryKeyColumns.map(pkcolumn => 'origin.' + pkcolumn.propertyName).join(', ')}]
			);
			console.log('${this.name}:', stmt);

			const [result] = await conn.execute<ResultSetHeader>(stmt);
			assert(result.affectedRows === 1, \`More than one row has been updated: \${result.affectedRows} rows affected\`);

			return Object.assign(origin, updates);
		}`);
	}

	private generateStaticDelete(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`static async delete(origin: ${this.dataTypeName}, conn: Pick<Connection, 'execute'>): Promise<void> {`);
		primaryKeyColumns.forEach(pkcolumn => {
			coder.add(`if (origin.${pkcolumn.propertyName} === null || origin.${pkcolumn.propertyName} === undefined) throw new Error('Argument origin.${pkcolumn.propertyName} cannot be null or undefined');`);
		});
		coder.add('');

		coder.add(`
			const stmt = mysql.format(
				\`DELETE FROM ${table.name} WHERE ${primaryKeyColumns.map(pkcolumn => pkcolumn.name + '=?').join(' AND ')}\`,
				[${primaryKeyColumns.map(pkcolumn => 'origin.' + pkcolumn.propertyName).join(', ')}]
			);
			console.log('${this.name}:', stmt);

			const [result] = await conn.execute<ResultSetHeader>(stmt);
			assert(result.affectedRows === 1, \`More than one row has been updated: \${result.affectedRows} rows affected\`);
		}`);
	}

	private generateConstructor(coder: JsCoder) {
		coder.add(`
			constructor(protected conn: Pick<Connection, 'execute'>) {}
		`);
	}
}
