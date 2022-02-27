import { ForeignKeyDefinition } from "model";

export interface Table {
	name: string;
	modelName: string;
	title?: string;
	description?: string;
	columns: Column[];
	primaryKeyColumns: Column[];
	indexes?: {name?: string, with: string[], unique?: boolean}[];
	foreignKeys?: ForeignKeyDefinition[];
	imports?: {
		[module: string]: string[]
	};
	modelFile: string;
}

export interface Column {
	name: string;
	title?: string;
	description?: string;
	type: string;
	notNull?: boolean;
	primaryKey?: boolean | 'sole';
	autoIncrement?: boolean;
	propertyName: string;
	propertyType: string;
	checkingType: string;
	propertyConverter?: string;
}
