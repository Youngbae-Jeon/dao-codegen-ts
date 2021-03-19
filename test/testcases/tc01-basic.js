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
				gender: {
					title: '성별',
					description: '- M: 남성\n- F: 여성',
					type: 'char(1) not null',
					property: {
						type: 'Gender',
						converter: 'GenderType'
					}
				},
				adult: {
					type: 'tinyint not null',
					property: { type: 'boolean' }
				},
				addr: {
					title: '주소',
					type: 'text'
				},
				status: {
					title: '상태',
					type: 'enum(\'normal\', \'blocked\', \'expired\') not null'
				},
				type: {
					title: '구분',
					type: 'enum(\'user\')'
				},
				nat_code: {
					title: '국가 코드',
					type: 'tinyint unsigned',
					property: {
						type: 'NatCode'
					},
				},
			},
			indexes: [
				{ with: ['name'] }
			],
			imports: {
				'../src/lib/types': ['Gender', 'GenderType', 'NatCode']
			}
		};
		prj.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcg-'))
		prj.modelDir = path.join(prj.dir, 'model');
		fs.mkdirSync(prj.modelDir);
		prj.modelFile = path.join(prj.modelDir, 'user.yaml');
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
		expect(generated.ts_files).to.deep.equal([`${prj.dir}/gen/dao/User.ts`]);

		const content = fs.readFileSync(generated.ts_files[0]).toString();
		expect(content).to.equal(`
// DO NOT EDIT THIS FILE:
// This file is generated from model file '../../model/user.yaml'
// by dao-codegen-ts
// --------------------
import _ from 'lodash';
import assert from 'assert';
import mysql, { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { Gender, GenderType, NatCode } from '../../src/lib/types';

export interface UserData {
	/** 이름 */
	name: string;
	/**
	 * 성별
	 * - M: 남성
	 * - F: 여성
	 */
	gender: Gender;
	adult: boolean;
	/** 주소 */
	addr?: string | null;
	/** 상태 */
	status: 'normal' | 'blocked' | 'expired';
	/** 구분 */
	type?: 'user' | null;
	/** 국가 코드 */
	nat_code?: NatCode | null;
}

/** 사용자 */
export interface User extends UserData {
	/** 사용자ID */
	id: number;
}

export class UserDao {
	static harvestData(row: {[name: string]: any}, dest?: any): UserData {
		if (!dest) dest = {};

		if (_.isString(row.name)) dest.name = row.name;
		else if (row.name === null || row.name === undefined) throw new Error('row.name cannot be null');
		else throw new TypeError('Wrong type for row.name');

		if (row.gender === null || row.gender === undefined) throw new Error('row.gender cannot be null');
		else dest.gender = GenderType.toPropertyValue(row.gender);

		if (_.isBoolean(row.adult)) dest.adult = row.adult;
		else if (_.isNumber(row.adult)) dest.adult = !!row.adult;
		else if (row.adult === null || row.adult === undefined) throw new Error('row.adult cannot be null');
		else throw new TypeError('Wrong type for row.adult');

		if (_.isString(row.addr)) dest.addr = row.addr;
		else if (row.addr === null || row.addr === undefined) dest.addr = null;
		else throw new TypeError('Wrong type for row.addr');

		if (_.isString(row.status)) dest.status = row.status;
		else if (row.status === null || row.status === undefined) throw new Error('row.status cannot be null');
		else throw new TypeError('Wrong type for row.status');

		if (_.isString(row.type)) dest.type = row.type;
		else if (row.type === null || row.type === undefined) dest.type = null;
		else throw new TypeError('Wrong type for row.type');

		if (_.isNumber(row.nat_code)) dest.nat_code = row.nat_code;
		else if (row.nat_code === null || row.nat_code === undefined) dest.nat_code = null;
		else throw new TypeError('Wrong type for row.nat_code');

		return dest;
	}

	static harvest(row: {[name: string]: any}, dest?: any): User {
		if (!dest) dest = {};

		if (_.isNumber(row.id)) dest.id = row.id;
		else if (row.id === null || row.id === undefined) throw new Error('row.id cannot be null');
		else throw new TypeError('Wrong type for row.id');

		this.harvestData(row, dest);
		return dest;
	}

	static async find(id: number, conn: Pick<Connection, 'execute'>, options?: {for?: 'update'}): Promise<User | undefined> {
		let sql = 'SELECT * FROM user WHERE id=?';
		if (options?.for === 'update') sql += ' FOR UPDATE';

		const stmt = mysql.format(sql, [id]);
		console.log('UserDao:', stmt);

		const [rows] = await conn.execute<RowDataPacket[]>(stmt);
		if (rows.length) {
			return this.harvest(rows[0]);
		}
	}

	static async filter(by: Partial<User>, conn: Pick<Connection, 'execute'>): Promise<User[]> {
		const wheres: string[] = [];
		const params: any[] = [];
		const keys = Object.keys(by);
		for (const key of keys) {
			const val = (by as any)[key];
			if (val === undefined || val === null) {
				wheres.push(\`\${key} IS NULL\`);
			} else {
				wheres.push(\`\${key}=?\`);
				if (key === 'gender') params.push(GenderType.toSqlValue(val));
				else params.push(val);
			}
		}

		let stmt = mysql.format(\`SELECT * FROM user\`, params);
		if (wheres.length) stmt += \` WHERE \${wheres.join(' AND ')}\`;
		console.log('UserDao:', stmt);

		const [rows] = await conn.execute<RowDataPacket[]>(stmt);
		return rows.map(row => this.harvest(row));
	}

	static async fetch(id: number, conn: Pick<Connection, 'execute'>, options?: {for?: 'update'}): Promise<User | undefined> {
		const found = await this.find(id, conn, options);
		if (!found) throw new Error(\`No such #User{id: \${id}}\`);
		return found;
	}

	static async create(data: UserData, conn: Pick<Connection, 'execute'>): Promise<User> {
		const params: {[name: string]: any} = {};
		if (data.name === null || data.name === undefined) throw new Error('data.name cannot be null or undefined');
		else params.name = data.name;

		if (data.gender === null || data.gender === undefined) throw new Error('data.gender cannot be null or undefined');
		else params.gender = GenderType.toSqlValue(data.gender);

		if (data.adult === null || data.adult === undefined) throw new Error('data.adult cannot be null or undefined');
		else params.adult = data.adult;

		if (data.addr === null || data.addr === undefined) params.addr = null;
		else params.addr = data.addr;

		if (data.status === null || data.status === undefined) throw new Error('data.status cannot be null or undefined');
		else params.status = data.status;

		if (data.type === null || data.type === undefined) params.type = null;
		else params.type = data.type;

		if (data.nat_code === null || data.nat_code === undefined) params.nat_code = null;
		else params.nat_code = data.nat_code;

		const stmt = mysql.format('INSERT INTO user SET ?', [params]);
		console.log('UserDao:', stmt);

		const [result] = await conn.execute<ResultSetHeader>(stmt);
		const id = result.insertId;
		return {...data, id};
	}

	static async update(origin: User, data: Partial<UserData>, conn: Pick<Connection, 'execute'>): Promise<User> {
		if (origin.id === null || origin.id === undefined) throw new Error('Argument origin.id cannot be null or undefined');

		const params: {[name: string]: any} = {};
		const updates: Partial<UserData> = {};
		if (data.name !== undefined) {
			if (data.name === null) throw new Error('data.name cannot be null or undefined');
			params.name = data.name;
			updates.name = data.name;
		}
		if (data.gender !== undefined) {
			if (data.gender === null) throw new Error('data.gender cannot be null or undefined');
			params.gender = GenderType.toSqlValue(data.gender);
			updates.gender = data.gender;
		}
		if (data.adult !== undefined) {
			if (data.adult === null) throw new Error('data.adult cannot be null or undefined');
			params.adult = data.adult;
			updates.adult = data.adult;
		}
		if (data.addr !== undefined) {
			params.addr = data.addr;
			updates.addr = data.addr;
		}
		if (data.status !== undefined) {
			if (data.status === null) throw new Error('data.status cannot be null or undefined');
			params.status = data.status;
			updates.status = data.status;
		}
		if (data.type !== undefined) {
			params.type = data.type;
			updates.type = data.type;
		}
		if (data.nat_code !== undefined) {
			params.nat_code = data.nat_code;
			updates.nat_code = data.nat_code;
		}

		const stmt = mysql.format(
			\`UPDATE user SET ? WHERE id=?\`,
			[params, origin.id]
		);
		console.log('UserDao:', stmt);

		const [result] = await conn.execute<ResultSetHeader>(stmt);
		assert(result.affectedRows === 1, \`More than one row has been updated: \${result.affectedRows} rows affected\`);

		return Object.assign(origin, updates);
	}

	static async delete(origin: User, conn: Pick<Connection, 'execute'>): Promise<void> {
		if (origin.id === null || origin.id === undefined) throw new Error('Argument origin.id cannot be null or undefined');

		const stmt = mysql.format(
			\`DELETE FROM user WHERE id=?\`,
			[origin.id]
		);
		console.log('UserDao:', stmt);

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
		expect(generated.sql_files).to.deep.equal([`${prj.dir}/gen/sql/user.sql`]);

		const content = fs.readFileSync(generated.sql_files[0]).toString();
		expect(content).to.equal(`
DROP TABLE IF EXISTS user;
CREATE TABLE user (
	id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, -- 사용자ID
	name CHAR(30) NOT NULL, -- 이름
	gender CHAR(1) NOT NULL, -- 성별
	adult TINYINT NOT NULL,
	addr TEXT, -- 주소
	status ENUM('normal', 'blocked', 'expired') NOT NULL, -- 상태
	type ENUM('user'), -- 구분
	nat_code TINYINT UNSIGNED, -- 국가 코드
	INDEX (name)
);
`.trimLeft()
		);
	});
});