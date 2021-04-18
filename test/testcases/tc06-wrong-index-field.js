const fs = require('fs');
const os = require('os');
const yaml = require('yaml');
const path = require('path');
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const expect = chai.expect;
const { executeGeneration } = require('../../dist/cli/generate');

describe('인덱스 필드명 오류 검출 테스트', () => {
	const prj = {};
	
	before(() => {
		const model = {
			table: 'product',
			title: '상품정보',
			columns: {
				product_no: {
					title: '상품번호',
					type: 'int unsigned primary key'
				},
				maker: {
					title: '제조사',
					type: 'int unsigned'
				},
                model_name: {
                    title: '모델명',
					type: 'varchar(50)'
                }
			},
            indexes: [
                { with: ['maker', 'model'], unque: true }
            ]
		};
		prj.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcg-'))
		prj.modelDir = path.join(prj.dir, 'model');
		fs.mkdirSync(prj.modelDir);
		prj.modelFile = path.join(prj.modelDir, 'product.yaml');
		fs.writeFileSync(prj.modelFile, yaml.stringify(model));
	});

	it('인덱스 필드명이 잘못되었음을 체크해야 함', async () => {
        await expect(executeGeneration({
			files: [
				prj.modelDir + '/**/*.yaml'
			],
			sql: {
				output: {
					dir: path.join(prj.dir, 'gen/sql')
				}
			}
		})).to.be.rejectedWith(Error, '정의되지 않은 컬럼 \'model\'이 인덱스에서 참조되었습니다');
    });
});
