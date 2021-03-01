const expect = require('chai').expect;
const { generateCodes } = require('../../dist/cli/generate');

describe('기본 모델 테스트', () => {
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
					type: 'Gender'
				}
			},
			adult: {
				type: 'tinyint not null',
				property: {
					type: 'boolean'
				}
			},
			addr: {
				title: '주소',
				type: 'text'
			}
		},
		imports: {
			'../lib/types': ['Gender']
		}
	};

	it('타입스크립트 코드가 정상적으로 생성되어야 함', async () => {
		const generated = await generateCodes(model, {
			files: ['user.yaml'],
			ts: {
				output: {
					dir: '/tmp/dao-codegen-ts/ts'
				}
			}
		});
		expect(generated).to.have.property('ts');
		expect(generated.ts).to.have.property('name', 'User');
		console.log(generated.ts.content);
		expect(generated.ts).to.have.property('content', `
// DO NOT EDIT THIS FILE:
// This file is generated by dao-codegen-ts.

import _ from 'lodash';
import { Connection } from 'mysql2/promise';

import { Gender } from '../lib/types';

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

		if (_.isString(row.gender)) dest.gender = row.gender;
		else if (row.gender === null || row.gender === undefined) throw new Error('row.gender cannot be null');
		else throw new TypeError('Wrong type for row.gender');

		if (_.isBoolean(row.adult)) dest.adult = row.adult;
		else if (_.isNumber(row.adult)) dest.adult = !!row.adult;
		else if (row.adult === null || row.adult === undefined) throw new Error('row.adult cannot be null');
		else throw new TypeError('Wrong type for row.adult');

		if (_.isString(row.addr)) dest.addr = row.addr;
		else if (row.addr === null || row.addr === undefined) row.addr = null;
		else throw new TypeError('Wrong type for row.addr');

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

	static async find(id: number, conn: Connection, options?: {for?: 'update'}): Promise<User | undefined> {
		let sql = 'SELECT * FROM user WHERE id=?';
		if (options?.for === 'update') sql += ' FOR UPDATE';

		const rows = await conn.query(sql, [id]);
		if (rows.length) {
			return this.harvest(row[0]);
		}
	}

	static async findAllBy(by: Partial<User>, conn: Connection): Promise<User[]> {
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

		const rows = await conn.query(\`SELECT * FROM user WHERE \${wheres.join(' AND ')}\`, params);
		return rows.map(row => this.harvest(row));
	}

	static async fetch(id: number, conn: Connection, options?: {for?: 'update'}): Promise<User | undefined> {
		const found = await this.find(id, conn, options);
		if (!found) throw new Error(\`No such #User{id: \${id}}\`);
		return found;
	}
}
`.trimLeft()
		);
	});

	it('SQL이 정상적으로 생성되어야 함', async () => {
		const generated = await generateCodes(model, {
			files: ['user.yaml'],
			sql: {
				output: {
					dir: '/tmp/dao-codegen-ts/sql'
				}
			}
		});
		expect(generated).to.have.property('sql');
		expect(generated.sql).to.have.property('name', 'user');
		expect(generated.sql).to.have.property('content', `
DROP TABLE IF EXISTS user;
CREATE TABLE user(
	id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, -- 사용자ID
	name CHAR(30) NOT NULL, -- 이름
	gender CHAR(1) NOT NULL, -- 성별
	adult TINYINT NOT NULL,
	addr TEXT -- 주소
);
`.trimLeft()
		);
	});
});