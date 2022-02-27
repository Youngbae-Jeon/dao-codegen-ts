import _ from 'lodash';

import { Generation } from '../config';
import { Table } from './table';

type Phrase = {expr: string, comment?: string};

export class SqlGenerator {
	private name: string;

	constructor(private table: Table, private options?: Generation['sql']) {
		this.name = `${options?.tableName?.prefix || ''}${table.name}${options?.tableName?.suffix || ''}`;
	}

	generate(): { name: string, content: string } {
		const lines: string[] = [];

		lines.push(`DROP TABLE IF EXISTS ${this.name};`);
		lines.push(`CREATE TABLE ${this.name} (`);
		lines.push(...this.generateTableInnerLines());
		lines.push(');');
		lines.push('');
		const content = lines.join('\n');

		return { name: this.name, content };
	}

	private generateTableInnerLines(): string[] {
		const table = this.table;
		const phrases: {expr: string, comment?: string}[] = [];
		phrases.push(...this.generateColumnPhrases());
		if (table.primaryKeyColumns.length > 1) {
			phrases.push(this.generatePrimaryKeyPhrase());
		}
		if (table.indexes?.length) {
			phrases.push(...this.generateIndexPhrases());
		}
		if (table.foreignKeys?.length) {
			phrases.push(...this.generateForeignKeyPhrases());
		}
		return this.convertPhrasesToLines('\t', phrases);
	}

	private generateColumnPhrases(): Phrase[] {
		return this.table.columns.map((column, i) => {
			let expr = `${column.name} ${column.type}`;
			if (column.notNull || column.primaryKey) expr += ' NOT NULL';
			if (column.autoIncrement) expr += ' AUTO_INCREMENT';
			if (column.primaryKey === 'sole') expr += ' PRIMARY KEY';

			return {expr, comment: column.title};
		});
	}

	private generatePrimaryKeyPhrase(): Phrase {
		return {expr: `PRIMARY KEY (${this.table.primaryKeyColumns.map(pkcolumn => pkcolumn.name).join(', ')})`};
	}

	private generateIndexPhrases(): Phrase[] {
		return _.map(this.table.indexes, (index, i) => {
			let expr = index.unique ? 'UNIQUE INDEX' : 'INDEX';
			if (index.name) expr += ` ${index.name}`
			expr += ` (${index.with.join(', ')})`;
			return {expr};
		});
	}

	private generateForeignKeyPhrases(): Phrase[] {
		return _.map(this.table.foreignKeys, (foreignKey, i) => {
			let expr = `FOREIGN KEY (${foreignKey.with.join(', ')}) `;
			expr += `REFERENCES ${foreignKey.references.table}(${foreignKey.references.columns.join(', ')})`;
			if (foreignKey.onDelete) {
				expr += ` ON DELETE ${foreignKey.onDelete}`;
			}
			if (foreignKey.onUpdate) {
				expr += ` ON UPDATE ${foreignKey.onUpdate}`;
			}
			return {expr};
		});
	}

	private convertPhrasesToLines(prefix: string, phrases: Phrase[]): string[] {
		return phrases.map((phrase, i) => {
			let line = prefix + phrase.expr
			if (i < phrases.length - 1) line += ',';
			if (phrase.comment) line += ' -- ' + phrase.comment;
			return line;
		})
	}
}	