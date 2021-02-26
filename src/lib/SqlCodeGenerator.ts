import { write } from 'fs';
import _ from 'lodash';
import { JsCoder } from './JsCoder';
import { ModulesCoder } from './ModulesCoder';
import { Table } from './table';
import { isPrimativeType, upperCamelCase } from './utils';

type Phrase = {expr: string, comment?: string};

export class SqlCodeGenerator {
	constructor(private table: Table, private options?: {prefix?: string, suffix?: string}) {}

	generate(): { name: string, content: string } {
		const lines: string[] = [];

		const table = this.table;
		lines.push(`DROP TABLE IF EXISTS ${table.name};`);
		lines.push(`CREATE TABLE ${table.name}(`);

		const phrases: {expr: string, comment?: string}[] = [];
		phrases.push(...this.generateColumnPhrases());

		if (table.primaryKeyColumns.length > 1) {
			phrases.push(this.generatePrimaryKeyPhrase());
		}

		if (table.indexes?.length) {
			phrases.push(...this.generateIndexPhrases());
		}

		phrases.forEach(phrase => {

		});

		lines.push(');');
		lines.push('');
		const content = lines.join('\n');

		return { name: table.name, content };
	}

	private generateColumnPhrases(): Phrase[] {
		return this.table.columns.map((column, i) => {
			let expr = `${column.name} ${column.type}`;
			if (column.notNull) expr += ' NOT NULL';
			if (column.autoIncrement) expr += ' AUTO_INCREMENT';
			if (column.solePrimaryKey) expr += ' PRIMARY KEY';

			return {expr, comment: column.title};
		});
	}

	private generatePrimaryKeyPhrase(): Phrase {
		return {expr: `PRIMARY KEY(${this.table.primaryKeyColumns.join(', ')})`};
	}

	private generateIndexPhrases(): Phrase[] {
		return _.map(this.table.indexes, (index, i) => {
			return {expr: `${index.unique ? 'UNIQUE INDEX' : 'INDEX'}(${index.with.join(', ')})`};
		});
	}

}	