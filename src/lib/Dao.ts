export class Dao {
	static splitObject(object: {[name: string]: any}, mapper?: {name?: (name: string) => string, value?: (value: any) => any}): {names: string[], values: any[]} {
		const result: {names: string[], values: any[]} = {names: [], values: []};

		return Object.keys(object).reduce((result, name) => {
			const value = object[name];
			result.names.push(mapper?.name ? mapper.name(name) : name);
			result.values.push(mapper?.value ? mapper.value(value) : value);
			return result;

		}, {names: [] as string[], values: [] as any[]});
	}
}