import { write } from 'fs';
import _ from 'lodash';
import { JsCoder } from './JsCoder';
import { ModulesCoder } from './ModulesCoder';
import { Table } from './table';
import { isPrimativeType, upperCamelCase } from './utils';

type Phrase = {expr: string, comment?: string};

export class SqlCodeGenerator {
	private name: string;

	constructor(private table: Table, private options?: {prefix?: string, suffix?: string}) {
		this.name = `${options?.prefix || ''}${table.name}${options?.suffix || ''}`;
	}

	generate(): { name: string, content: string } {
		const lines: string[] = [];

		lines.push(`DROP TABLE IF EXISTS ${this.name};`);
		lines.push(`CREATE TABLE ${this.name}(`);
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
		return this.convertPhrasesToLines('\t', phrases);
	}

	private generateColumnPhrases(): Phrase[] {
		return this.table.columns.map((column, i) => {
			let expr = `${column.name} ${column.type.toUpperCase()}`;
			if (column.notNull || column.primaryKey) expr += ' NOT NULL';
			if (column.autoIncrement) expr += ' AUTO_INCREMENT';
			if (column.primaryKey === 'sole') expr += ' PRIMARY KEY';

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

	private convertPhrasesToLines(prefix: string, phrases: Phrase[]): string[] {
		return phrases.map((phrase, i) => {
			let line = prefix + phrase.expr
			if (i < phrases.length - 1) line += ',';
			if (phrase.comment) line += ' -- ' + phrase.comment;
			return line;
		})
	}
}	