const fs = require('fs');
const os = require('os');
const yaml = require('yaml');
const path = require('path');
const expect = require('chai').expect;
const { executeGeneration } = require('../../dist/cli/generate');

describe('PK만으로 구성된 테이블 모델 테스트', () => {
	const prj = {};
	
	before(() => {
		const model = {
			table: 'options',
			title: '옵션',
			columns: {
				color: {
					title: '색상',
					type: 'int unsigned'
				},
				size: {
					title: '사이즈',
					type: 'int unsigned'
				}
			},
			primaryKey: ['color', 'size'],
		};
		prj.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcg-'))
		prj.modelDir = path.join(prj.dir, 'model');
		fs.mkdirSync(prj.modelDir);
		prj.modelFile = path.join(prj.modelDir, 'options.yaml');
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
		expect(generated.ts_files).to.deep.equal([`${prj.dir}/gen/dao/Options.ts`]);

		const content = fs.readFileSync(generated.ts_files[0]).toString();
		expect(content).to.equal(`
// DO NOT EDIT THIS FILE:
// This file is generated from model file '../../model/options.yaml'
// by dao-codegen-ts
// --------------------
import _ from 'lodash';
import assert from 'assert';
import mysql, { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/** 옵션 */
export interface Options {
	/** 색상 */
	color: number;
	/** 사이즈 */
	size: number;
}

export class OptionsDao {
	static harvest(row: {[name: string]: any}, dest?: any): Options {
		if (!dest) dest = {};

		if (_.isNumber(row.color)) dest.color = row.color;
		else if (row.color === null || row.color === undefined) throw new Error('row.color cannot be null');
		else throw new TypeError('Wrong type for row.color');

		if (_.isNumber(row.size)) dest.size = row.size;
		else if (row.size === null || row.size === undefined) throw new Error('row.size cannot be null');
		else throw new TypeError('Wrong type for row.size');

		return dest;
	}

	static assign(dest: any, src: {[name: string]: any}): Partial<Options> {
		if (src.color !== undefined) {
			if (src.color === null) throw new Error('src.color cannot be null or undefined');
			dest.color = src.color;
		}
		if (src.size !== undefined) {
			if (src.size === null) throw new Error('src.size cannot be null or undefined');
			dest.size = src.size;
		}
		return dest;
	}

	static async find(color: number, size: number, conn: Pick<Connection, 'execute'>, options?: {for?: 'update'}): Promise<Options | undefined> {
		let sql = 'SELECT * FROM options WHERE color=? AND size=?';
		if (options?.for === 'update') sql += ' FOR UPDATE';

		const stmt = mysql.format(sql, [color, size]);
		console.log('OptionsDao:', stmt);

		const [rows] = await conn.execute<RowDataPacket[]>(stmt);
		if (rows.length) {
			return this.harvest(rows[0]);
		}
	}

	static async filter(by: Partial<Options>, conn: Pick<Connection, 'execute'>): Promise<Options[]> {
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

		let stmt = \`SELECT * FROM options\`;
		if (wheres.length) stmt += mysql.format(\` WHERE \${wheres.join(' AND ')}\`, params);
		console.log('OptionsDao:', stmt);

		const [rows] = await conn.execute<RowDataPacket[]>(stmt);
		return rows.map(row => this.harvest(row));
	}

	static async fetch(color: number, size: number, conn: Pick<Connection, 'execute'>, options?: {for?: 'update'}): Promise<Options> {
		const found = await this.find(color, size, conn, options);
		if (!found) throw new Error(\`No such #Options{color: \${color}, size: \${size}}\`);
		return found;
	}

	static async create(color: number, size: number, conn: Pick<Connection, 'execute'>): Promise<Options> {
		if (color === null || color === undefined) throw new Error('Argument color cannot be null or undefined');
		if (size === null || size === undefined) throw new Error('Argument size cannot be null or undefined');

		const stmt = mysql.format('INSERT INTO options SET color=?, size=?', [color, size]);
		console.log('OptionsDao:', stmt);

		await conn.execute<ResultSetHeader>(stmt);
		return {color, size};
	}

	static async delete(origin: Options, conn: Pick<Connection, 'execute'>): Promise<void> {
		if (origin.color === null || origin.color === undefined) throw new Error('Argument origin.color cannot be null or undefined');
		if (origin.size === null || origin.size === undefined) throw new Error('Argument origin.size cannot be null or undefined');

		const stmt = mysql.format(
			\`DELETE FROM options WHERE color=? AND size=?\`,
			[origin.color, origin.size]
		);
		console.log('OptionsDao:', stmt);

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
		expect(generated.sql_files).to.deep.equal([`${prj.dir}/gen/sql/options.sql`]);

		const content = fs.readFileSync(generated.sql_files[0]).toString();
		expect(content).to.equal(`
DROP TABLE IF EXISTS options;
CREATE TABLE options (
	color INT UNSIGNED NOT NULL, -- 색상
	size INT UNSIGNED NOT NULL, -- 사이즈
	PRIMARY KEY (color, size)
);
`.trimLeft()
		);
	});
});