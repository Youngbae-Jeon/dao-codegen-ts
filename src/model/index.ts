import Ajv from 'ajv';
import { TaskRunner } from 'dependency-task-runner';
import fs from 'fs';
import { noop, reduce } from 'lodash';
import path from 'path';
import yaml from 'yaml';

import schema from './schema.json';


export interface ModelDefinition {
	/** 모델명 */
	name?: string;
	/** 파일명 */
	filepath?: string;
	/** 테이블명 */
	table: string;
	/** 한글명 */
	title?: string;
	/** 한글설명 */
	description?: string;
	/** 컬럼 */
	columns: {
		[name: string]: ColumnDefinition
	};
	/** 기본키 */
	primaryKey?: string[];
	/** 인덱스 */
	indexes?: IndexDefinition[];
	/** 외래키 */
	foreignKeys?: ForeignKeyDefinition[];
	/** 테이블 의존성 */
	dependencies?: string[];
	imports?: {
		[module: string]: string[]
	}
}

export interface ColumnDefinition {
	/** 한글명 */
	title?: string;
	/** 한글설명 */
	description?: string;
	/** DB 타입 */
	type: string;
	/** DAO 클래스 속성 */
	property?: {
		/** 속성명 */
		name?: string;
		/** 속성타입 */
		type?: string;
		/**
		 * 속성타입 변환기 이름, imports에 모듈을 추가해주어야 함
		 * converter는 다음 두개의 메서드를 가지고 있어야 함
		 * - toPropertyValue: (sqlValue: any) => any;
		 * - toSqlValue: (propertyValue: any) => any;
		 */
		converter?: string;
	}
}

export interface IndexDefinition {
	/** 인덱스명 */
	name?: string;
	/** 인덱스 컬럼 리스트 */
	with: string[];
	/** unique 인덱스 여부 */
	unique?: boolean;
}

type ReferentialOption = 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT';
export interface ForeignKeyDefinition {
	/** 외래키 컬럼 리스트 */
	with: string[];
	references: {
		table: string;
		columns: string[];
	}
	onDelete?: ReferentialOption;
	onUpdate?: ReferentialOption;
}

function getModelFilepath(filename: string) {
	const filepath = path.resolve(process.cwd(), filename);
	if (!fs.existsSync(filepath)) throw new Error(`No such file: ${filename}`)
	return filepath;
}

function readModelFile(dest: {[key: string]: any}, filepath: string): ModelDefinition {
    try {
        const contents = fs.readFileSync(filepath);
		const config = yaml.parse(contents.toString());
		validateModel(config);

		Object.assign(dest, config, {filepath});
		return dest as ModelDefinition;

    } catch (err: any) {
        throw new Error(`Error occured while reading config file ${filepath}: ${err.message}`);
    }
}

function validateModel(model: any) {
    const ajv = new Ajv();
    const ajvValidate = ajv.compile(schema);
    if (!ajvValidate(model)) throw new Error(ajv.errorsText(ajvValidate.errors, {dataVar: 'config'}));
}


export async function loadModel(filename: string): Promise<ModelDefinition> {
	const filepath = getModelFilepath(filename);
	return readModelFile({}, filepath);
}

export async function loadModels(files: string[], options?: {orderByDependency?: boolean}): Promise<ModelDefinition[]> {
	let models = await Promise.all(files.map(file => loadModel(file)));

	models.forEach(model => {
		model.dependencies = reduce(model.foreignKeys, (dependencies: string[], fk) => {
			const dependency = fk.references.table;
			// 외래키 테이블이 models 목록에 있는 경우에만 dependency 추가함
			if (models.find(model => model.table === dependency)) {
				dependencies.push(dependency);
			}
			return dependencies;
		}, []);
	});

	if (options?.orderByDependency !== false) {
		return orderByDependency(models);
	}
	return models;
}

function orderByDependency(models: ModelDefinition[]): ModelDefinition[] {
	const taskRunner = new TaskRunner();
	taskRunner.add(...models.map(model => ({ name: model.table, dependencies: model.dependencies })));
	return taskRunner.schedule().map(task => models.find(model => model.table === task.name)!);
}
