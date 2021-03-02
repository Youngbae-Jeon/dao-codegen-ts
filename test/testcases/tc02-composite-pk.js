const expect = require('chai').expect;
const { generateCodes } = require('../../dist/cli/generate');

describe('복합키 모델 테스트', () => {
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
		primaryKey: ['product_no', 'variant_no']
	};

	it('인터페이스가 정상적으로 생성되어야 함', async () => {
		const generated = await generateCodes(model, {
			files: ['product_variant.yaml'],
			ts: {
				output: {
					dir: '/tmp/dao-codegen-ts/ts'
				}
			}
		});
		expect(generated).to.have.property('ts');
		expect(generated.ts).to.have.property('name', 'ProductVariant');
		console.log(generated.ts.content);
		expect(generated.ts).to.have.property('content', `
// DO NOT EDIT THIS FILE:
// This file is generated by dao-codegen-ts.

import _ from 'lodash';
import { Connection } from 'mysql2/promise';

export interface ProductVariantData {
	/** 색상 */
	color?: string | null;
	/** 사이즈 */
	size?: string | null;
}

/** 품목정보 */
export interface ProductVariant extends ProductVariantData {
	/** 상품번호 */
	productNo: number;
	/** 품목번호 */
	variantNo: number;
}

export class ProductVariantDao {
	static harvestData(row: {[name: string]: any}, dest?: any): ProductVariantData {
		if (!dest) dest = {};

		if (_.isString(row.color)) dest.color = row.color;
		else if (row.color === null || row.color === undefined) row.color = null;
		else throw new TypeError('Wrong type for row.color');

		if (_.isString(row.size)) dest.size = row.size;
		else if (row.size === null || row.size === undefined) row.size = null;
		else throw new TypeError('Wrong type for row.size');

		return dest;
	}

	static harvest(row: {[name: string]: any}, dest?: any): ProductVariant {
		if (!dest) dest = {};

		if (_.isNumber(row.product_no)) dest.productNo = row.product_no;
		else if (row.product_no === null || row.product_no === undefined) throw new Error('row.product_no cannot be null');
		else throw new TypeError('Wrong type for row.product_no');

		if (_.isNumber(row.variant_no)) dest.variantNo = row.variant_no;
		else if (row.variant_no === null || row.variant_no === undefined) throw new Error('row.variant_no cannot be null');
		else throw new TypeError('Wrong type for row.variant_no');

		this.harvestData(row, dest);
		return dest;
	}

	static async find(productNo: number, variantNo: number, conn: Connection, options?: {for?: 'update'}): Promise<ProductVariant | undefined> {
		let sql = 'SELECT * FROM product_variant WHERE product_no=? AND variant_no=?';
		if (options?.for === 'update') sql += ' FOR UPDATE';

		const rows = await conn.query(sql, [productNo, variantNo]);
		if (rows.length) {
			return this.harvest(row[0]);
		}
	}

	static async filter(by: Partial<ProductVariant>, conn: Connection): Promise<ProductVariant[]> {
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

		const rows = await conn.query(\`SELECT * FROM product_variant WHERE \${wheres.join(' AND ')}\`, params);
		return rows.map(row => this.harvest(row));
	}

	static async fetch(productNo: number, variantNo: number, conn: Connection, options?: {for?: 'update'}): Promise<ProductVariant | undefined> {
		const found = await this.find(productNo, variantNo, conn, options);
		if (!found) throw new Error(\`No such #ProductVariant{productNo: \${productNo}, variantNo: \${variantNo}}\`);
		return found;
	}

	static async insert(productNo: number, variantNo: number, data: ProductVariantData, conn: Connection, options: { onDuplicate?: 'update' }): Promise<ProductVariant> {
		if (productNo === null || productNo === undefined) throw new Error('Argument productNo cannot be null or undefined');
		if (variantNo === null || variantNo === undefined) throw new Error('Argument variantNo cannot be null or undefined');

		const fields: {[name: string]: any} = {};
		if (data.color === null || data.color === undefined) fields.color = null;
		else fields.color = data.color;

		if (data.size === null || data.size === undefined) fields.size = null;
		else fields.size = data.size;

		if (options?.onDuplicate === 'update') {
			await conn.update('INSERT INTO product_variant SET product_no, variant_no, ? ON DUPLICATE KEY UPDATE ?', [productNo, variantNo, fields, fields]);
		} else {
			await conn.update('INSERT INTO product_variant SET product_no, variant_no, ?', [productNo, variantNo, fields]);
		}

		return {...data, productNo, variantNo};
	}

	static async update(origin: ProductVariant, data: Partial<ProductVariantData>, conn: Connection): Promise<ProductVariant> {
		if (origin.productNo === null || origin.productNo === undefined) throw new Error('Argument origin.productNo cannot be null or undefined');
		if (origin.variantNo === null || origin.variantNo === undefined) throw new Error('Argument origin.variantNo cannot be null or undefined');

		const fields: {[name: string]: any} = {};
		const updates: Partial<ProductVariantData> = {};
		if (data.color !== undefined) {
			fields.color = data.color;
			updates.color = data.color;
		}
		if (data.size !== undefined) {
			fields.size = data.size;
			updates.size = data.size;
		}
		await conn.update(
			'UPDATE product_variant SET ? WHERE product_no, variant_no',
			[fields, [origin.productNo, origin.variantNo]
		);
		return Object.assign(origin, updates);
	}
}
`.trimLeft()
		);
	});

	it('SQL이 정상적으로 생성되어야 함', async () => {
		const generated = await generateCodes(model, {
			files: ['product_variant.yaml'],
			sql: {
				output: {
					dir: '/tmp/dao-codegen-ts/sql'
				}
			}
		});
		expect(generated).to.have.property('sql');
		expect(generated.sql).to.have.property('name', 'product_variant');
		expect(generated.sql).to.have.property('content', `
DROP TABLE IF EXISTS product_variant;
CREATE TABLE product_variant(
	product_no INT UNSIGNED NOT NULL, -- 상품번호
	variant_no INT UNSIGNED NOT NULL, -- 품목번호
	color CHAR(20), -- 색상
	size CHAR(10), -- 사이즈
	PRIMARY KEY(product_no, variant_no)
);
`.trimLeft()
		);
	});
});