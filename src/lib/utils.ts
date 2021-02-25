import _ from "lodash";

export function capitalizeFirstLetter(str: string): string {
	return str.charAt(0).toUpperCase() + str.substring(1);
}

export function upperCamelCase(str: string): string {
	return capitalizeFirstLetter(_.camelCase(str));
}
