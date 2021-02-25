import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

import schema from './schema.json';


export interface ModelDefinition {
	/** 테이블명 */
	table: string;
	/** 한글명 */
	title: string;
	columns: ColumnDefinition[];
	constraints: IndexDefinition[];
}

export interface ColumnDefinition {

}

export interface IndexDefinition {
	index: string[];
}

export interface IField {
	name: string;
	type: string;
	notnull: boolean;
	auto_increment: boolean;
	pk: boolean;
	jstype: string;
	desc?: string;
}

export interface ITable {
	name: string;
	entityName: string;
	fields: IField[];
	constraints?: string[];
	desc?: string;
	fetchLock?: boolean;
}

function getModelFilepath(filename: string) {
	const filepath = path.resolve(process.cwd(), filename);
	if (!fs.existsSync(filepath)) throw new Error(`No such file: ${filename}`)
	return filepath;
}

function readModelFile(dest: {[key: string]: any}, filepath: string): ITable {
    try {
        const contents = fs.readFileSync(filepath);
		const config = yaml.parse(contents.toString());
		validateModel(config);

		Object.assign(dest, config);
		return dest as ITable;

    } catch (err) {
        throw new Error(`Error occured while reading config file ${filepath}: ${err.message}`);
    }
}

function validateModel(model: any) {
    const ajv = new Ajv();
    const ajvValidate = ajv.compile(schema);
    if (!ajvValidate(model)) throw new Error(ajv.errorsText(ajvValidate.errors, {dataVar: 'config'}));
}

export async function loadModel(filename: string): Promise<ITable> {
	const filepath = getModelFilepath(filename);
	const model = readModelFile({}, filepath);
	return model;
}
