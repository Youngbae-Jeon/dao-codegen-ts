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
				dataTypeOnly: true,
				output: {
					dir: path.join(prj.dir, 'gen/dao')
				}
			}
		});
		expect(generated).to.have.property('ts_files');
		expect(generated.ts_files).to.deep.equal([`${prj.dir}/gen/dao/Product.ts`]);

		const content = fs.readFileSync(generated.ts_files[0]).toString();
		expect(content).to.equal(`
// DO NOT EDIT THIS FILE:
// This file is generated from model file '../../model/product.yaml'
// by dao-codegen-ts
// --------------------
import { Shipment, Supply } from '../../src/lib/types';

export interface ProductData {
	/** 배송정보 */
	shipment?: {way: Shipment.Way, pay: Shipment.FixedPay | Pick<Shipment.IncrementalPay, 'increment' | 'step'> | null} | null;
	/** 스펙 */
	spec?: Array<{title: string, desc: string | number | boolean | Date}> | null;
	/** 공급정보 */
	supply?: {supplier_id: number, price: number | Supply.SOLD_OUT}[] | null;
}

/** 상품정보 */
export interface Product extends ProductData {
	/** 상품번호 */
	product_no: number;
}
`.trimLeft()
		);
	});
});
