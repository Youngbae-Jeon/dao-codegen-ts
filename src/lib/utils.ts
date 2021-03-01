import { assert } from "console";
import _ from "lodash";
import { Column } from "./table";

export function upperCamelCase(str: string): string {
	return _.upperFirst(_.camelCase(str));
}

const PRIMATIVE_TYPES = ['number', 'string', 'boolean', 'any', 'Date'];
export function isPrimativeType(type: string): boolean {
	return PRIMATIVE_TYPES.includes(type);
}
