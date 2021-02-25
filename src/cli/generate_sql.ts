import _ from 'lodash';

import { ITable } from '../model';
import { Config } from './spec';

export const generate_sql = (table: ITable, config: Config): string => {
	const lines: string[] = [];

	lines.push(`DROP TABLE IF EXISTS ${table.name};`);
	lines.push(`CREATE TABLE ${table.name}(`);

	const lastFieldIdx = table.fields.length - 1;
	const tableConstraintsLen = table.constraints && table.constraints.length;
	_.each(table.fields, (f, i) => {
		let line = `\t${f.name} ${f.type}`;
		if (f.notnull) line += ' NOT NULL';
		if (f.auto_increment) line += ' AUTO_INCREMENT';
		if (f.pk) line += ' PRIMARY KEY';

		if (i < lastFieldIdx || tableConstraintsLen) line += ',';
		if (f.desc) line += ` -- ${f.desc}`;
		lines.push(line);
	});

	const lastTableConstraintsIdx = (tableConstraintsLen || 0) - 1;
	_.each(table.constraints, (c, i) => {
		let line = `\t${c}`;

		if (i < lastTableConstraintsIdx) line += ',';
		lines.push(line);
	});

	lines.push(');');
	lines.push('');

	return lines.join('\n');
};
