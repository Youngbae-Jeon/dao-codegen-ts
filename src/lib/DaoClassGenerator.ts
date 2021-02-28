import { JsCoder } from "./JsCoder";
import { ModulesCoder } from "./ModulesCoder";
import { Table } from "./table";
import { upperCamelCase } from "./utils";

export class DaoClassGenerator {
	private name: string;

	constructor(private table: Table, private options?: {daoClassName?: {prefix?: string, suffix?: string}}) {
		this.name = upperCamelCase(`${options?.daoClassName?.prefix || ''}_${table.modelName || table.name}_${options?.daoClassName?.suffix || ''}`);
	}

	generate(modules: ModulesCoder): JsCoder {
		const coder = new JsCoder();

		if (coder.length()) coder.add('');
		return coder;
	}
}