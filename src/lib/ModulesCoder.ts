import _ from 'lodash';
import path from 'path';

import { JsCoder } from './JsCoder';

interface Importing {
	defaultAlias?: string;
	types: string[];
	module: string;
}

export class ModulesCoder {
	private absoluteImporting: Importing[] = [];
	private relativeImporting: Importing[] = [];

	constructor(private options?: {baseDir: string, outDir: string}) {}

	private pushTo(types: string | string[], importing: Importing) {
		const pushType = (type: string) => {
			if (importing.types.indexOf(type) < 0) {
				importing.types.push(type);
			}
		}

		if (_.isArray(types)) {
			for (const type of types) {
				pushType(type);
			}
		} else {
			pushType(types);
		}
	}

	private resolvePath(module: string) {
		if (this.options && module.startsWith('.')) {
			console.log('***', this.options.outDir, this.options.baseDir, module);
			return path.relative(this.options.outDir, path.resolve(this.options.baseDir, module));
		} else {
			return module;
		}
	}

	importDefault(alias: string, module: string) {
		module = this.resolvePath(module);
		const importings = module.startsWith('.') ? this.relativeImporting : this.absoluteImporting;
		const found = importings.find(importing => importing.module === module);
		if (found) {
			found.defaultAlias = alias;
		} else {
			importings.push({defaultAlias: alias, types: [], module: module});
		}
	}

	import(types: string | string[], module: string) {
		module = this.resolvePath(module);
		const importings = module.startsWith('.') ? this.relativeImporting : this.absoluteImporting;
		const found = importings.find(importing => importing.module === module);
		if (found) {
			this.pushTo(types, found);
		} else {
			importings.push({types: (_.isArray(types) ? types : [types]), module: module});
		}
	}

	getCode(): JsCoder {
		const makeCode = (importingList: Importing[], code: JsCoder) => {
			importingList = _.sortBy(importingList, 'from');

			for (const importing of importingList) {
				importing.types.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

				if (importing.defaultAlias && importing.types.length) {
					code.add(`import ${importing.defaultAlias}, { ${importing.types.join(', ')} } from '${importing.module}';`);

				} else if (importing.defaultAlias) {
					code.add(`import ${importing.defaultAlias} from '${importing.module}';`);

				} else if (importing.types.length) {
					code.add(`import { ${importing.types.join(', ')} } from '${importing.module}';`);

				} else throw new Error('This line should not be reached: ' + JSON.stringify(importing));
			}
		}

		const relatives = this.relativeImporting;
		const absolutes = this.absoluteImporting;

		const coder = new JsCoder();

		if (absolutes.length) {
			makeCode(absolutes, coder);
			if (relatives.length) coder.add('');
		}

		if (relatives.length) {
			makeCode(relatives, coder);
		}

		if (coder.length()) coder.add('');
		return coder;
	}
}