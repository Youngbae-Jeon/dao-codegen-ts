import _ from "lodash";
import { JsCoder } from "./JsCoder";
import { ModulesCoder } from "./ModulesCoder";
import { Column, Table } from "./table";
import { TypeExpression } from "./TypeExpression";
import { isKnownGenericType, isPrimativeType, upperCamelCase } from "./utils";

export class DaoClassGenerator {
	private name: string;
	private dataTypeName: string;
	private insertMany: boolean;

	constructor(private table: Table, options: {dataTypeName: string, daoClassName?: {prefix?: string, suffix?: string}, insertMany?: boolean}) {
		const prefix = _.isString(options.daoClassName?.prefix) ? options.daoClassName?.prefix: '';
		const suffix = _.isString(options.daoClassName?.suffix) ? options.daoClassName?.suffix : 'Dao';
		this.name = upperCamelCase(`${prefix}_${table.modelName || table.name}_${suffix}`);
		this.dataTypeName = options.dataTypeName;
		this.insertMany = options.insertMany || false;
	}

	generate(modules: ModulesCoder): {name: string, code: JsCoder} {
		const coder = new JsCoder();
		this.writeImports(modules);

		this.generateTypeDefinitions(coder);
		coder.add('');

		const hasDataColumns = this.table.columns.length > this.table.primaryKeyColumns.length;

		coder.add(`export class ${this.name} {`);
		if (hasDataColumns) {
			this.generateStaticHarvestData(coder);
			coder.add('');
		}
		this.generateStaticHarvest(coder, hasDataColumns);
		coder.add('');
		if (hasDataColumns) {
			this.generateStaticAssignData(coder);
			coder.add('');
		}
		this.generateStaticAssign(coder, hasDataColumns);
		coder.add('');
		if (hasDataColumns) {
			this.generateStaticToSqlValues(coder);
			coder.add('');
		}
		this.generateStaticLog(coder);
		coder.add('');
		this.generateStaticFind(coder);
		coder.add('');
		this.generateStaticFilter(coder);
		coder.add('');
		this.generateStaticFetch(coder);
		coder.add('');
		this.generateStaticCreate(coder, hasDataColumns);
		coder.add('');
		if (hasDataColumns) {
			this.generateStaticUpdate(coder);
			coder.add('');
		}
		this.generateStaticDelete(coder);
		if (this.insertMany) {
			this.generateStaticInsertMany(coder, hasDataColumns);
		}
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
		if (this.insertMany) {
			mc.import('escape', 'sqlstring');
		}
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

	private generateTypeDefinitions(coder: JsCoder) {
		coder.add(`type Nullable<T> = { [P in keyof T]: T[P] | null };`);
		coder.add(`type StatementType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';`);
		coder.add(`type LogFunction = (sql: string, options: {name: string, type: StatementType}) => void;`);
	}

	private generateStaticHarvestData(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;
		coder.add(`static harvestData(row: {[name: string]: any}): ${this.dataTypeName}Data;`);
		coder.add(`static harvestData<T>(row: {[name: string]: any}, dest: T): ${this.dataTypeName}Data & T;`);
		coder.add(`static harvestData(row: {[name: string]: any}, dest?: any) {`);
		coder.add(`if (!dest) dest = {};`);
		coder.add('');

		table.columns.filter(column => !primaryKeyColumns.find(pkcolumn => pkcolumn.name === column.name)).forEach(column => this.generateHarvestColumn(column, coder));

		coder.add(`
			return dest;
		}`);
	}

	private generateStaticHarvest(coder: JsCoder, hasDataColumns: boolean) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`static harvest(row: {[name: string]: any}): ${this.dataTypeName};`);
		coder.add(`static harvest<T>(row: {[name: string]: any}, dest: T): ${this.dataTypeName} & T;`);
		coder.add(`static harvest(row: {[name: string]: any}, dest?: any) {`);
		coder.add(`if (!dest) dest = {};`);
		coder.add('');

		table.columns.filter(column => primaryKeyColumns.find(pkcolumn => pkcolumn.name === column.name)).forEach(column => this.generateHarvestColumn(column, coder));

		if (hasDataColumns) {
			coder.add(`this.harvestData(row, dest);`);
		}
		coder.add(`
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

	private generateStaticAssignData(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`static assignData(dest: any, src: {[name: string]: any}): Partial<${this.dataTypeName}Data> {`);

		table.columns.filter(column => !primaryKeyColumns.find(pkcolumn => pkcolumn.name === column.name)).forEach(column => this.generateAssignColumn(column, coder));

		coder.add(`
			return dest;
		}`);
	}

	private generateStaticAssign(coder: JsCoder, hasDataColumns: boolean) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`static assign(dest: any, src: {[name: string]: any}): Partial<${this.dataTypeName}> {`);

		table.columns.filter(column => primaryKeyColumns.find(pkcolumn => pkcolumn.name === column.name)).forEach(column => this.generateAssignColumn(column, coder));

		if (hasDataColumns) {
			coder.add(`this.assignData(dest, src);`);
		}
		coder.add(`
			return dest;
		}`);
	}

	private generateAssignColumn(column: Column, coder: JsCoder) {
		coder.add(`if (src.${column.propertyName} !== undefined) {`);
		if (column.notNull) {
			coder.add(`if (src.${column.propertyName} === null) throw new Error('src.${column.propertyName} cannot be null or undefined');`);
			if (column.propertyType === 'Date') {
				coder.add(`dest.${column.propertyName} = new Date(src.${column.propertyName});`);
			} else {
				coder.add(`dest.${column.propertyName} = src.${column.propertyName};`);
			}
		} else {
			if (column.propertyType === 'Date') {
				coder.add(`dest.${column.propertyName} = src.${column.propertyName} === null ? null : new Date(src.${column.propertyName});`);
			} else {
				coder.add(`dest.${column.propertyName} = src.${column.propertyName};`);
			}
		}
		coder.add('}');
	}

	private generateStaticToSqlValues(coder: JsCoder) {
		const table = this.table;

		coder.add(`
		static toSqlValues(data: Partial<${this.dataTypeName}Data>): {[name: string]: any} {
			const params: {[name: string]: any} = {};
		`);

		table.columns.filter(column => !column.primaryKey).forEach(column => {
			coder.add(`if (data.${column.propertyName} !== undefined) {`);
			if (column.propertyConverter) {
				if (column.notNull) {
					coder.add(`params.${column.name} = ${column.propertyConverter}.toSqlValue(data.${column.propertyName});`);
				} else {
					coder.add(`if (data.${column.propertyName} === null) params.${column.name} = null;`);
					coder.add(`else params.${column.name} = ${column.propertyConverter}.toSqlValue(data.${column.propertyName});`);
				}
			} else {
				if (column.type === 'JSON') {
					coder.add(`params.${column.name} = JSON.stringify(data.${column.propertyName});`);
				} else {
					coder.add(`params.${column.name} = data.${column.propertyName};`);
				}
			}
			coder.add('}');
		});

		coder.add(`
			return params;
		}`);
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

	private generateStaticLog(coder: JsCoder): void {
		coder.add(`
		static log(stmt: string, type: StatementType, log?: LogFunction) {
			if (log) {
				log(stmt, {name: '${this.name}', type});
			} else {
				console.log('${this.name}:', stmt);
			}
		}`);
	}

	private generateStaticFind(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;
		const pkargs = primaryKeyColumns.map(pkcolumn => `${pkcolumn.propertyName}: ${pkcolumn.propertyType}`).join(', ');
		coder.add(`
		static async find(${pkargs}, conn: Pick<Connection, 'execute'>, options?: {for?: 'update', log?: LogFunction}): Promise<${this.dataTypeName} | undefined> {
			let sql = 'SELECT * FROM ${table.name} WHERE ${primaryKeyColumns.map(pkcolumn => `${pkcolumn.name}=?`).join(' AND ')}';
			if (options?.for === 'update') sql += ' FOR UPDATE';

			const stmt = mysql.format(sql, [${primaryKeyColumns.map(p => p.propertyName).join(', ')}]);
			this.log(stmt, 'SELECT', options?.log);

			const [rows] = await conn.execute<RowDataPacket[]>(stmt);
			if (rows.length) {
				return this.harvest(rows[0]);
			}
		}`);
	}

	private generateStaticFilter(coder: JsCoder) {
		coder.add(`
		static async filter(by: Partial<Nullable<${this.dataTypeName}>>, conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<${this.dataTypeName}[]> {
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

			let stmt = \`SELECT * FROM ${this.table.name}\`;
			if (wheres.length) stmt += mysql.format(\` WHERE \${wheres.join(' AND ')}\`, params);
			this.log(stmt, 'SELECT', options?.log);

			const [rows] = await conn.execute<RowDataPacket[]>(stmt);
			return rows.map(row => this.harvest(row));
		}`);
	}

	private generateStaticFetch(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;
		const pkargs = primaryKeyColumns.map(pkcolumn => `${pkcolumn.propertyName}: ${pkcolumn.propertyType}`).join(', ');
		coder.add(`
		static async fetch(${pkargs}, conn: Pick<Connection, 'execute'>, options?: {for?: 'update', log?: LogFunction}): Promise<${this.dataTypeName}> {
			const found = await this.find(${primaryKeyColumns.map(p => p.propertyName).join(', ')}, conn, options);
			if (!found) throw new Error(\`No such #${this.dataTypeName}{${primaryKeyColumns.map(p => p.propertyName + ': ${' + p.propertyName + '}').join(', ')}}\`);
			return found;
		}`);
	}

	private generateStaticCreate(coder: JsCoder, hasDataColumns: boolean) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		if (primaryKeyColumns.length === 1 && primaryKeyColumns[0].autoIncrement) {
			coder.add(hasDataColumns
				? `static async create(data: ${this.dataTypeName}Data, conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<${this.dataTypeName}> {`
				: `static async create(conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<${this.dataTypeName}> {`);
		} else {
			const pkargs = primaryKeyColumns.map(pkcolumn => `${pkcolumn.propertyName}: ${pkcolumn.propertyType}`).join(', ');
			coder.add(hasDataColumns
				? `static async create(${pkargs}, data: ${this.dataTypeName}Data, conn: Pick<Connection, 'execute'>, options?: {onDuplicate?: 'update', log?: LogFunction}): Promise<${this.dataTypeName}> {`
				: `static async create(${pkargs}, conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<${this.dataTypeName}> {`);
			primaryKeyColumns.forEach(pkcolumn => {
				coder.add(`if (${pkcolumn.propertyName} === null || ${pkcolumn.propertyName} === undefined) throw new Error('Argument ${pkcolumn.propertyName} cannot be null or undefined');`);
			});
			coder.add('');
		}

		if (hasDataColumns) {
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
		}

		if (primaryKeyColumns.length === 1 && primaryKeyColumns[0].autoIncrement) {
			coder.add(hasDataColumns
				? `const stmt = mysql.format('INSERT INTO ${table.name} SET ?', [params]);`
				: `const stmt = 'INSERT INTO ${table.name}'`);
			coder.add(`
			this.log(stmt, 'INSERT', options?.log);

			const [result] = await conn.execute<ResultSetHeader>(stmt);
			const ${primaryKeyColumns[0].propertyName} = result.insertId;
			`);
			coder.add(hasDataColumns
				? `return {...data, ${primaryKeyColumns.map(pkcolumn => pkcolumn.propertyName).join(', ')}};`
				: `return {${primaryKeyColumns.map(pkcolumn => pkcolumn.propertyName).join(', ')}};`);

		} else if (hasDataColumns) {
			coder.add(`
			let stmt: string;
			if (options?.onDuplicate === 'update') {
				stmt = mysql.format('INSERT INTO ${table.name} SET ${primaryKeyColumns.map(pkcolumn => pkcolumn.name + "=?").join(', ')}, ? ON DUPLICATE KEY UPDATE ?', [${primaryKeyColumns.map(pkcolumn => pkcolumn.propertyName).join(', ')}, params, params]);
			} else {
				stmt = mysql.format('INSERT INTO ${table.name} SET ${primaryKeyColumns.map(pkcolumn => pkcolumn.name + "=?").join(', ')}, ?', [${primaryKeyColumns.map(pkcolumn => pkcolumn.propertyName).join(', ')}, params]);
			}
			this.log(stmt, 'INSERT', options?.log);

			await conn.execute<ResultSetHeader>(stmt);
			return {...data, ${primaryKeyColumns.map(pkcolumn => pkcolumn.propertyName).join(', ')}};
			`);
		} else {
			coder.add(`
			const stmt = mysql.format('INSERT INTO ${table.name} SET ${primaryKeyColumns.map(pkcolumn => pkcolumn.name + "=?").join(', ')}', [${primaryKeyColumns.map(pkcolumn => pkcolumn.propertyName).join(', ')}]);
			this.log(stmt, 'INSERT', options?.log);

			await conn.execute<ResultSetHeader>(stmt);
			return {${primaryKeyColumns.map(pkcolumn => pkcolumn.propertyName).join(', ')}};
			`);
		}
		coder.add('}');
	}

	private generateStaticInsertMany(coder: JsCoder, hasDataColumns: boolean) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		if (primaryKeyColumns.length === 1 && primaryKeyColumns[0].autoIncrement) {
			coder.add(`
			static async insertMany(dataList: ${this.dataTypeName}Data[], conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<ResultSetHeader> {
			`);
		} else {
			coder.add(`
			static async insertMany(dataList: ${this.dataTypeName}[], conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<ResultSetHeader> {
			`);
		}

		coder.add(`
		const values = dataList.map(data => [
		`);
		const columns = (primaryKeyColumns.length === 1 && primaryKeyColumns[0].autoIncrement) ? table.columns.filter(column => !column.primaryKey) : table.columns;
		columns.forEach(column => {
			if (column.propertyConverter) {
				coder.add(`${column.propertyConverter}.toSqlValue(data.${column.propertyName}),`);
			} else {
				if (column.type === 'JSON') {
					coder.add(`data.${column.propertyName} == null ? null : JSON.stringify(data.${column.propertyName}),`);
				} else {
					coder.add(`data.${column.propertyName},`);
				}
			}
		});
		coder.add(`
		]);
		const stmt = \`INSERT INTO ${table.name} (${columns.map(column => column.name).join(',')}) VALUES \${escape(values)}\`;
		this.log(stmt, 'INSERT', options?.log);

		const [result] = await conn.execute<ResultSetHeader>(stmt);
		return result;
		`);
		coder.add('}');
	}

	private generateStaticUpdate(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`static async update(origin: ${this.dataTypeName}, data: Partial<${this.dataTypeName}Data>, conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<${this.dataTypeName}> {`);
		primaryKeyColumns.forEach(pkcolumn => {
			coder.add(`if (origin.${pkcolumn.propertyName} === null || origin.${pkcolumn.propertyName} === undefined) throw new Error('Argument origin.${pkcolumn.propertyName} cannot be null or undefined');`);
		});
		coder.add('');

		coder.add(`
			const updates = this.assignData({}, data);
			const params = this.toSqlValues(updates);

			const stmt = mysql.format(
				\`UPDATE ${table.name} SET ? WHERE ${primaryKeyColumns.map(pkcolumn => pkcolumn.name + '=?').join(' AND ')}\`,
				[params, ${primaryKeyColumns.map(pkcolumn => 'origin.' + pkcolumn.propertyName).join(', ')}]
			);
			this.log(stmt, 'UPDATE', options?.log);

			const [result] = await conn.execute<ResultSetHeader>(stmt);
			assert(result.affectedRows === 1, \`More than one row has been updated: \${result.affectedRows} rows affected\`);

			return Object.assign(origin, updates);
		}`);
	}

	private generateStaticDelete(coder: JsCoder) {
		const table = this.table;
		const primaryKeyColumns = table.primaryKeyColumns;

		coder.add(`static async delete(origin: ${this.dataTypeName}, conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<void> {`);
		primaryKeyColumns.forEach(pkcolumn => {
			coder.add(`if (origin.${pkcolumn.propertyName} === null || origin.${pkcolumn.propertyName} === undefined) throw new Error('Argument origin.${pkcolumn.propertyName} cannot be null or undefined');`);
		});
		coder.add('');

		coder.add(`
			const stmt = mysql.format(
				\`DELETE FROM ${table.name} WHERE ${primaryKeyColumns.map(pkcolumn => pkcolumn.name + '=?').join(' AND ')}\`,
				[${primaryKeyColumns.map(pkcolumn => 'origin.' + pkcolumn.propertyName).join(', ')}]
			);
			this.log(stmt, 'DELETE', options?.log);

			const [result] = await conn.execute<ResultSetHeader>(stmt);
			assert(result.affectedRows === 1, \`More than one row has been updated: \${result.affectedRows} rows affected\`);
		}`);
	}
}
