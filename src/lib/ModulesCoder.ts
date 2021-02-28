import _ from 'lodash';
import { JsCoder } from './JsCoder';

interface Importing {
	defaultAlias?: string;
	types: string[];
	module: string;
}

export class ModulesCoder {
	importingList: Importing[] = [];

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

	importDefault(alias: string, module: string) {
		const found = _.find(this.importingList, {module});
		if (found) {
			found.defaultAlias = alias;
		} else {
			this.importingList.push({defaultAlias: alias, types: [], module});
		}
	}

	import(types: string | string[], module: string) {
		const found = _.find(this.importingList, {module});
		if (found) {
			this.pushTo(types, found);
		} else {
			this.importingList.push({types: (_.isArray(types) ? types : [types]), module});
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

		let [relatives, absolutes] = _.partition(this.importingList, (importing) => { return importing.module.startsWith('.'); });

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