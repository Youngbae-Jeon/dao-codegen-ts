const fs = require('fs');
const os = require('os');
const yaml = require('yaml');
const path = require('path');
const expect = require('chai').expect;
const { executeGeneration } = require('../../dist/cli/generate');

describe('기본 모델 테스트', () => {
	const prj = {};
	
	before(() => {
		const model = {
			table: 'user',
			title: '사용자',
			columns: {
				id: {
					title: '사용자ID',
					type: 'int unsigned auto_increment primary key'
				},
				name: {
					title: '이름',
					type: 'char(30) not null'
				},
				company_id: {
					title: '소속사ID',
					type: 'int unsigned not null',
				}
			},
			foreignKeys: [
				{
					with: ['company_id'],
					references: {
						table: 'company',
						columns: ['id']
					},
					onDelete: 'CASCADE',
					onUpdate: 'RESTRICT',
				}
			],
		};
		prj.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcg-'))
		prj.modelDir = path.join(prj.dir, 'model');
		fs.mkdirSync(prj.modelDir);
		prj.modelFile = path.join(prj.modelDir, 'user.yaml');
		fs.writeFileSync(prj.modelFile, yaml.stringify(model));
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
		expect(generated.sql_files).to.deep.equal([`${prj.dir}/gen/sql/user.sql`]);

		const content = fs.readFileSync(generated.sql_files[0]).toString();
		expect(content).to.equal(`
DROP TABLE IF EXISTS user;
CREATE TABLE user (
	id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, -- 사용자ID
	name CHAR(30) NOT NULL, -- 이름
	company_id INT UNSIGNED NOT NULL, -- 소속사ID
	FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE ON UPDATE RESTRICT
);
`.trimLeft()
		);
	});
});
