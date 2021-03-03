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

const KNOWN_GENERIC_TYPES = [
	'Array', 'Partial', 'Required', 'Readonly', 'Record', 'Pick', 'Omit',
	'Exclude', 'Extract', 'NonNullable', 'Parameters', 'ConstructorParameters',
	'ReturnType', 'InstanceType', 'ThisParameterType', 'OmitThisParameter', 'ThisType',
	'Uppercase', 'Lowercase', 'Capitalize', 'Uncapitalize'
];
export function isKnownGenericType(type: string): boolean {
	return KNOWN_GENERIC_TYPES.includes(type);
}
