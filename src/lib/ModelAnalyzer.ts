import _ from 'lodash';
import { ColumnDefinition, ModelDefinition } from 'model';

import { Column, Table } from './table';
import { upperCamelCase } from './utils';

export class ModelAnalyzer {
	constructor(private model: ModelDefinition) {}

	private getName() {
		return this.model.name || upperCamelCase(this.model.table);
	}

	private findPrimaryKeyColumnNames(): string[] {
		const model = this.model;
		if (model.primaryKey) {
			model.primaryKey.forEach((name) => {
				const columnDefinition = model.columns[name];
				if (!columnDefinition) throw new Error(`'${name}' of primaryKey does not exists in columns.`);
			});
			return model.primaryKey;

		} else {
			return Object.keys(model.columns).filter((name) => {
				const columnDefinition = model.columns[name];
				return /\bPRIMARY KEY\b/i.test(columnDefinition.type);
			});
		}
	}

	analyze(): Table {
		const primaryKeyColumnNames = this.findPrimaryKeyColumnNames();
		if (!primaryKeyColumnNames.length) throw new Error(`Model should have a primary key.`);

		const model = this.model;
		const columns = this.analyzeColumns(primaryKeyColumnNames);
		const primaryKeyColumns = primaryKeyColumnNames.map(columnName => columns.find(column => column.name === columnName)!);
		const table: Table = {
			name: model.table,
			modelName: this.getName(),
			columns,
			primaryKeyColumns
		};
		if (model.title) table.title = model.title;
		if (model.description) table.description = model.description;
		if (model.imports) table.imports = model.imports;

		return table;
	}

	private analyzeColumns(primaryKeyColumns: string[]): Column[] {
		const solePrimaryKey = primaryKeyColumns.length === 1 && primaryKeyColumns[0];

		const columns: Column[] = [];
		_.forOwn(this.model.columns, (columnDefinition, name) => {
			const primaryKey = solePrimaryKey === name ? 'sole' : primaryKeyColumns.includes(name);
			const column = new ColumnAnalyzer(columnDefinition, name, primaryKey).analyze();
			columns.push(column);
		});
		return columns;
	}
}

class ColumnAnalyzer {
	constructor(private definition: ColumnDefinition, private name: string, private primaryKey: boolean | 'sole') {}

	private getPropertyName(): string {
		return this.definition.property?.name || _.camelCase(this.name);
	}

	private resolveType(): { type: string, propertyType: string } {
		const type = this.definition.type;

		const intType = /\b(INT|TINYINT|SMALLINT|BIGINT)(\([0-9]+\))?(\s+UNSIGNED)?\b/i.exec(type);
		if (intType) return { type: intType[0], propertyType: 'number' };

		const numericType = /\bNUMERIC\([0-9]+,[0-9]+\)(\s+UNSIGNED)?\b/i.exec(type);
		if (numericType) return { type: numericType[0], propertyType: 'number' };

		const charType = /\b(CHAR|VARCHAR)\([0-9]+\)/i.exec(type);
		if (charType) return { type: charType[0], propertyType: 'string' };

		const textType = /\bTEXT\b/i.exec(type);
		if (textType) return { type: textType[0], propertyType: 'string' };

		const datetimeType = /\bDATETIME(\([0-6]\))?\b/i.exec(type);
		if (datetimeType) return { type: datetimeType[0], propertyType: 'Date' };

		const dateType = /\bDATE\b/i.exec(type);
		if (dateType) return { type: dateType[0], propertyType: 'Date' };

		const jsonType = /\bJSON\b/i.exec(type);
		if (jsonType) return { type: jsonType[0], propertyType: 'any' };

		throw new Error(`Cannot parse type for '${this.name}': ${type}`);
	}

	private isNotNull(): boolean {
		return /\bNOT\s+NULL\b/i.test(this.definition.type);
	}

	private isAutoIncrement(): boolean {
		return this.primaryKey === 'sole' && /\bAUTO_INCREMENT\b/i.test(this.definition.type);
	}

	analyze(): Column {
		const definition = this.definition;
		const { type, propertyType } = this.resolveType();
		const column: Column =  {
			name: this.name,
			type,
			propertyName: this.getPropertyName(),
			propertyType: definition.property?.type || propertyType
		};
		if (definition.title) column.title = definition.title;
		if (definition.description) column.description = definition.description;
		if (this.isNotNull()) column.notNull = true;
		if (this.primaryKey) {
			column.primaryKey = this.primaryKey;
			column.notNull = true;
		}
		if (this.isAutoIncrement()) column.autoIncrement = true;
		return column;
	}
}
