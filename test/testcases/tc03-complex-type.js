const fs = require('fs');
const os = require('os');
const yaml = require('yaml');
const path = require('path');
const expect = require('chai').expect;
const { executeGeneration } = require('../../dist/cli/generate');

describe('복잡한 타입 테스트', () => {
	const prj = {};
	
	before(() => {
		const model = {
			table: 'product',
			title: '상품정보',
			columns: {
				product_no: {
					title: '상품번호',
					type: 'int unsigned'
				},
				shipment: {
					title: '배송정보',
					type: 'JSON',
					property: {
						type: '{way: Shipment.Way, pay: Shipment.FixedPay | Pick<Shipment.IncrementalPay, \'increment\' | \'step\'> | null}'
					}
				},
				spec: {
					title: '스펙',
					type: 'JSON',
					property: {
						type: 'Array<{title: string, desc: string | number | boolean | Date}>'
					}
				},
				supply: {
					title: '공급정보',
					type: 'JSON',
					property: {
						type: '{supplier_id: number, price: number | Supply.SOLD_OUT}[]'
					}
				},
				etc: {
					type: 'json not null'
				}
			},
			primaryKey: ['product_no'],
			imports: {
				'../src/lib/types': ['Shipment', 'Supply']
			}
		};
		prj.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcg-'))
		prj.modelDir = path.join(prj.dir, 'model');
		fs.mkdirSync(prj.modelDir);
		prj.modelFile = path.join(prj.modelDir, 'product.yaml');
		fs.writeFileSync(prj.modelFile, yaml.stringify(model));
	});

	it('타입스크립트 코드가 정상적으로 생성되어야 함', async () => {
		const generated = await executeGeneration({
			files: [
				prj.modelDir + '/**/*.yaml'
			],
			ts: {
				output: {
					dir: path.join(prj.dir, 'gen/dao')
				}
			}
		});
		expect(generated).to.have.property('ts_files');
		expect(generated.ts_files).to.deep.equal([`${prj.dir}/gen/dao/Product.ts`]);

		const content = fs.readFileSync(generated.ts_files[0]).toString();
		// console.log(content);
		expect(content).to.equal(`
// DO NOT EDIT THIS FILE:
// This file is generated from model file '../../model/product.yaml'
// by dao-codegen-ts
// --------------------
import _ from 'lodash';
import assert from 'assert';
import mysql, { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { Shipment, Supply } from '../../src/lib/types';

export interface ProductData {
	/** 배송정보 */
	shipment?: {way: Shipment.Way, pay: Shipment.FixedPay | Pick<Shipment.IncrementalPay, 'increment' | 'step'> | null} | null;
	/** 스펙 */
	spec?: Array<{title: string, desc: string | number | boolean | Date}> | null;
	/** 공급정보 */
	supply?: {supplier_id: number, price: number | Supply.SOLD_OUT}[] | null;
	etc: any;
}

/** 상품정보 */
export interface Product extends ProductData {
	/** 상품번호 */
	product_no: number;
}

type Nullable<T> = { [P in keyof T]: T[P] | null };
type StatementType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
type LogFunction = (sql: string, options: {name: string, type: StatementType}) => void;

export class ProductDao {
	static harvestData(row: {[name: string]: any}): ProductData;
	static harvestData<T>(row: {[name: string]: any}, dest: T): ProductData & T;
	static harvestData(row: {[name: string]: any}, dest?: any) {
		if (!dest) dest = {};

		if (row.shipment === null || row.shipment === undefined) dest.shipment = null;
		else dest.shipment = row.shipment;

		if (row.spec === null || row.spec === undefined) dest.spec = null;
		else dest.spec = row.spec;

		if (row.supply === null || row.supply === undefined) dest.supply = null;
		else dest.supply = row.supply;

		if (row.etc === null || row.etc === undefined) throw new Error('row.etc cannot be null');
		else dest.etc = row.etc;

		return dest;
	}

	static harvest(row: {[name: string]: any}): Product;
	static harvest<T>(row: {[name: string]: any}, dest: T): Product & T;
	static harvest(row: {[name: string]: any}, dest?: any) {
		if (!dest) dest = {};

		if (_.isNumber(row.product_no)) dest.product_no = row.product_no;
		else if (row.product_no === null || row.product_no === undefined) throw new Error('row.product_no cannot be null');
		else throw new TypeError('Wrong type for row.product_no');

		this.harvestData(row, dest);
		return dest;
	}

	static assignData(dest: any, src: {[name: string]: any}): Partial<ProductData> {
		if (src.shipment !== undefined) {
			dest.shipment = src.shipment;
		}
		if (src.spec !== undefined) {
			dest.spec = src.spec;
		}
		if (src.supply !== undefined) {
			dest.supply = src.supply;
		}
		if (src.etc !== undefined) {
			if (src.etc === null) throw new Error('src.etc cannot be null or undefined');
			dest.etc = src.etc;
		}
		return dest;
	}

	static assign(dest: any, src: {[name: string]: any}): Partial<Product> {
		if (src.product_no !== undefined) {
			if (src.product_no === null) throw new Error('src.product_no cannot be null or undefined');
			dest.product_no = src.product_no;
		}
		this.assignData(dest, src);
		return dest;
	}

	static toSqlValues(data: Partial<ProductData>): {[name: string]: any} {
		const params: {[name: string]: any} = {};
		if (data.shipment !== undefined) {
			params.shipment = JSON.stringify(data.shipment);
		}
		if (data.spec !== undefined) {
			params.spec = JSON.stringify(data.spec);
		}
		if (data.supply !== undefined) {
			params.supply = JSON.stringify(data.supply);
		}
		if (data.etc !== undefined) {
			params.etc = JSON.stringify(data.etc);
		}
		return params;
	}

	static log(stmt: string, type: StatementType, log?: LogFunction) {
		if (log) {
			log(stmt, {name: 'ProductDao', type});
		} else {
			console.log('ProductDao:', stmt);
		}
	}

	static async find(product_no: number, conn: Pick<Connection, 'execute'>, options?: {for?: 'update', log?: LogFunction}): Promise<Product | undefined> {
		let sql = 'SELECT * FROM product WHERE product_no=?';
		if (options?.for === 'update') sql += ' FOR UPDATE';

		const stmt = mysql.format(sql, [product_no]);
		this.log(stmt, 'SELECT', options?.log);

		const [rows] = await conn.execute<RowDataPacket[]>(stmt);
		if (rows.length) {
			return this.harvest(rows[0]);
		}
	}

	static async filter(by: Partial<Nullable<Product>>, conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<Product[]> {
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

		let stmt = \`SELECT * FROM product\`;
		if (wheres.length) stmt += mysql.format(\` WHERE \${wheres.join(' AND ')}\`, params);
		this.log(stmt, 'SELECT', options?.log);

		const [rows] = await conn.execute<RowDataPacket[]>(stmt);
		return rows.map(row => this.harvest(row));
	}

	static async fetch(product_no: number, conn: Pick<Connection, 'execute'>, options?: {for?: 'update', log?: LogFunction}): Promise<Product> {
		const found = await this.find(product_no, conn, options);
		if (!found) throw new Error(\`No such #Product{product_no: \${product_no}}\`);
		return found;
	}

	static async query(sql: string, conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<Product[]>;
	static async query(sql: string, params: any[], conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<Product[]>;
	static async query(sql: string, arg1: any, arg2: any, arg3?: any): Promise<Product[]> {
		let conn: Pick<Connection, 'execute'>;
		let options: {log?: LogFunction} | undefined;
		if (Array.isArray(arg1)) {
			sql = mysql.format(sql, arg1);
			conn = arg2;
			options = arg3;
		} else {
			conn = arg1;
			options = arg2;
		}
		this.log(sql, 'SELECT', options?.log);
		const [rows] = await conn.execute<RowDataPacket[]>(sql);
		return rows.map(row => this.harvest(row));
	}

	static async create(product_no: number, data: ProductData, conn: Pick<Connection, 'execute'>, options?: {onDuplicate?: 'update', log?: LogFunction}): Promise<Product> {
		if (product_no === null || product_no === undefined) throw new Error('Argument product_no cannot be null or undefined');

		const params: {[name: string]: any} = {};
		if (data.shipment === null || data.shipment === undefined) params.shipment = null;
		else params.shipment = JSON.stringify(data.shipment);

		if (data.spec === null || data.spec === undefined) params.spec = null;
		else params.spec = JSON.stringify(data.spec);

		if (data.supply === null || data.supply === undefined) params.supply = null;
		else params.supply = JSON.stringify(data.supply);

		if (data.etc === null || data.etc === undefined) throw new Error('data.etc cannot be null or undefined');
		else params.etc = JSON.stringify(data.etc);

		let stmt: string;
		if (options?.onDuplicate === 'update') {
			stmt = mysql.format('INSERT INTO product SET product_no=?, ? ON DUPLICATE KEY UPDATE ?', [product_no, params, params]);
		} else {
			stmt = mysql.format('INSERT INTO product SET product_no=?, ?', [product_no, params]);
		}
		this.log(stmt, 'INSERT', options?.log);

		await conn.execute<ResultSetHeader>(stmt);
		return {...data, product_no};
	}

	static async update(origin: Product, data: Partial<ProductData>, conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<Product> {
		if (origin.product_no === null || origin.product_no === undefined) throw new Error('Argument origin.product_no cannot be null or undefined');

		const updates = this.assignData({}, data);
		const params = this.toSqlValues(updates);

		const stmt = mysql.format(
			\`UPDATE product SET ? WHERE product_no=?\`,
			[params, origin.product_no]
		);
		this.log(stmt, 'UPDATE', options?.log);

		const [result] = await conn.execute<ResultSetHeader>(stmt);
		assert(result.affectedRows === 1, \`More than one row has been updated: \${result.affectedRows} rows affected\`);

		return Object.assign(origin, updates);
	}

	static async delete(origin: Product, conn: Pick<Connection, 'execute'>, options?: {log?: LogFunction}): Promise<void> {
		if (origin.product_no === null || origin.product_no === undefined) throw new Error('Argument origin.product_no cannot be null or undefined');

		const stmt = mysql.format(
			\`DELETE FROM product WHERE product_no=?\`,
			[origin.product_no]
		);
		this.log(stmt, 'DELETE', options?.log);

		const [result] = await conn.execute<ResultSetHeader>(stmt);
		assert(result.affectedRows === 1, \`More than one row has been updated: \${result.affectedRows} rows affected\`);
	}
}
`.trimLeft()
		);
	});
});
