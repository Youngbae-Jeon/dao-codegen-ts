const fs = require('fs');
const os = require('os');
const yaml = require('yaml');
const path = require('path');
const expect = require('chai').expect;
const { executeGeneration } = require('../../dist/cli/generate');

describe('복합키 모델 테스트', () => {
	const prj = {};
	
	before(() => {
		const model = {
			table: 'product_variant',
			title: '품목정보',
			columns: {
				product_no: {
					title: '상품번호',
					type: 'int unsigned'
				},
				variant_no: {
					title: '품목번호',
					type: 'int unsigned'
				},
				color: {
					title: '색상',
					type: 'char(20)'
				},
				size: {
					title: '사이즈',
					type: 'char(10)'
				}
			},
			primaryKey: ['product_no', 'variant_no'],
			indexes: [
				{ with: ['product_no', 'color', 'size'], unique: true }
			]
		};
		prj.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcg-'))
		prj.modelDir = path.join(prj.dir, 'model');
		fs.mkdirSync(prj.modelDir);
		prj.modelFile = path.join(prj.modelDir, 'product_variant.yaml');
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
		expect(generated.ts_files).to.deep.equal([`${prj.dir}/gen/dao/ProductVariant.ts`]);

		const content = fs.readFileSync(generated.ts_files[0]).toString();
		expect(content).to.equal(`
// DO NOT EDIT THIS FILE:
// This file is generated from model file '../../model/product_variant.yaml'
// by dao-codegen-ts
// --------------------
import _ from 'lodash';
import assert from 'assert';
import mysql, { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export interface ProductVariantData {
	/** 색상 */
	color?: string | null;
	/** 사이즈 */
	size?: string | null;
}

/** 품목정보 */
export interface ProductVariant extends ProductVariantData {
	/** 상품번호 */
	product_no: number;
	/** 품목번호 */
	variant_no: number;
}

export class ProductVariantDao {
	static harvestData(row: {[name: string]: any}, dest?: any): ProductVariantData {
		if (!dest) dest = {};

		if (_.isString(row.color)) dest.color = row.color;
		else if (row.color === null || row.color === undefined) dest.color = null;
		else throw new TypeError('Wrong type for row.color');

		if (_.isString(row.size)) dest.size = row.size;
		else if (row.size === null || row.size === undefined) dest.size = null;
		else throw new TypeError('Wrong type for row.size');

		return dest;
	}

	static harvest(row: {[name: string]: any}, dest?: any): ProductVariant {
		if (!dest) dest = {};

		if (_.isNumber(row.product_no)) dest.product_no = row.product_no;
		else if (row.product_no === null || row.product_no === undefined) throw new Error('row.product_no cannot be null');
		else throw new TypeError('Wrong type for row.product_no');

		if (_.isNumber(row.variant_no)) dest.variant_no = row.variant_no;
		else if (row.variant_no === null || row.variant_no === undefined) throw new Error('row.variant_no cannot be null');
		else throw new TypeError('Wrong type for row.variant_no');

		this.harvestData(row, dest);
		return dest;
	}

	static assignData(dest: any, src: {[name: string]: any}): Partial<ProductVariantData> {
		if (src.color !== undefined) {
			dest.color = src.color;
		}
		if (src.size !== undefined) {
			dest.size = src.size;
		}
		return dest;
	}

	static assign(dest: any, src: {[name: string]: any}): Partial<ProductVariant> {
		if (src.product_no !== undefined) {
			if (src.product_no === null) throw new Error('src.product_no cannot be null or undefined');
			dest.product_no = src.product_no;
		}
		if (src.variant_no !== undefined) {
			if (src.variant_no === null) throw new Error('src.variant_no cannot be null or undefined');
			dest.variant_no = src.variant_no;
		}
		this.assignData(dest, src);
		return dest;
	}

	static toSqlValues(data: Partial<ProductVariantData>): {[name: string]: any} {
		const params: {[name: string]: any} = {};
		if (data.color !== undefined) {
			params.color = data.color;
		}
		if (data.size !== undefined) {
			params.size = data.size;
		}
		return params;
	}

	static async find(product_no: number, variant_no: number, conn: Pick<Connection, 'execute'>, options?: {for?: 'update'}): Promise<ProductVariant | undefined> {
		let sql = 'SELECT * FROM product_variant WHERE product_no=? AND variant_no=?';
		if (options?.for === 'update') sql += ' FOR UPDATE';

		const stmt = mysql.format(sql, [product_no, variant_no]);
		console.log('ProductVariantDao:', stmt);

		const [rows] = await conn.execute<RowDataPacket[]>(stmt);
		if (rows.length) {
			return this.harvest(rows[0]);
		}
	}

	static async filter(by: Partial<ProductVariant>, conn: Pick<Connection, 'execute'>): Promise<ProductVariant[]> {
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

		let stmt = \`SELECT * FROM product_variant\`;
		if (wheres.length) stmt += mysql.format(\` WHERE \${wheres.join(' AND ')}\`, params);
		console.log('ProductVariantDao:', stmt);

		const [rows] = await conn.execute<RowDataPacket[]>(stmt);
		return rows.map(row => this.harvest(row));
	}

	static async fetch(product_no: number, variant_no: number, conn: Pick<Connection, 'execute'>, options?: {for?: 'update'}): Promise<ProductVariant> {
		const found = await this.find(product_no, variant_no, conn, options);
		if (!found) throw new Error(\`No such #ProductVariant{product_no: \${product_no}, variant_no: \${variant_no}}\`);
		return found;
	}

	static async create(product_no: number, variant_no: number, data: ProductVariantData, conn: Pick<Connection, 'execute'>, options?: { onDuplicate?: 'update' }): Promise<ProductVariant> {
		if (product_no === null || product_no === undefined) throw new Error('Argument product_no cannot be null or undefined');
		if (variant_no === null || variant_no === undefined) throw new Error('Argument variant_no cannot be null or undefined');

		const params: {[name: string]: any} = {};
		if (data.color === null || data.color === undefined) params.color = null;
		else params.color = data.color;

		if (data.size === null || data.size === undefined) params.size = null;
		else params.size = data.size;

		let stmt: string;
		if (options?.onDuplicate === 'update') {
			stmt = mysql.format('INSERT INTO product_variant SET product_no=?, variant_no=?, ? ON DUPLICATE KEY UPDATE ?', [product_no, variant_no, params, params]);
		} else {
			stmt = mysql.format('INSERT INTO product_variant SET product_no=?, variant_no=?, ?', [product_no, variant_no, params]);
		}
		console.log('ProductVariantDao:', stmt);

		await conn.execute<ResultSetHeader>(stmt);
		return {...data, product_no, variant_no};
	}

	static async update(origin: ProductVariant, data: Partial<ProductVariantData>, conn: Pick<Connection, 'execute'>): Promise<ProductVariant> {
		if (origin.product_no === null || origin.product_no === undefined) throw new Error('Argument origin.product_no cannot be null or undefined');
		if (origin.variant_no === null || origin.variant_no === undefined) throw new Error('Argument origin.variant_no cannot be null or undefined');

		const updates = this.assignData({}, data);
		const params = this.toSqlValues(updates);

		const stmt = mysql.format(
			\`UPDATE product_variant SET ? WHERE product_no=? AND variant_no=?\`,
			[params, origin.product_no, origin.variant_no]
		);
		console.log('ProductVariantDao:', stmt);

		const [result] = await conn.execute<ResultSetHeader>(stmt);
		assert(result.affectedRows === 1, \`More than one row has been updated: \${result.affectedRows} rows affected\`);

		return Object.assign(origin, updates);
	}

	static async delete(origin: ProductVariant, conn: Pick<Connection, 'execute'>): Promise<void> {
		if (origin.product_no === null || origin.product_no === undefined) throw new Error('Argument origin.product_no cannot be null or undefined');
		if (origin.variant_no === null || origin.variant_no === undefined) throw new Error('Argument origin.variant_no cannot be null or undefined');

		const stmt = mysql.format(
			\`DELETE FROM product_variant WHERE product_no=? AND variant_no=?\`,
			[origin.product_no, origin.variant_no]
		);
		console.log('ProductVariantDao:', stmt);

		const [result] = await conn.execute<ResultSetHeader>(stmt);
		assert(result.affectedRows === 1, \`More than one row has been updated: \${result.affectedRows} rows affected\`);
	}
}
`.trimLeft()
		);
	});

	it('SQL이 정상적으로 생성되어야 함', async () => {
		const generated = await executeGeneration({
			files: [
				prj.modelDir + '/**/*.yaml'
			],
			sql: {
				output: {
					dir: path.join(prj.dir, 'gen/sql')
				}
			}
		});
		expect(generated).to.have.property('sql_files');
		expect(generated.sql_files).to.deep.equal([`${prj.dir}/gen/sql/product_variant.sql`]);

		const content = fs.readFileSync(generated.sql_files[0]).toString();
		expect(content).to.equal(`
DROP TABLE IF EXISTS product_variant;
CREATE TABLE product_variant (
	product_no INT UNSIGNED NOT NULL, -- 상품번호
	variant_no INT UNSIGNED NOT NULL, -- 품목번호
	color CHAR(20), -- 색상
	size CHAR(10), -- 사이즈
	PRIMARY KEY (product_no, variant_no),
	UNIQUE INDEX (product_no, color, size)
);
`.trimLeft()
		);
	});
});