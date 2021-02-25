import _ from 'lodash';

import { IField, ITable } from '../model';

export interface Config {
	mrshopDir?: string;
}

export const CustomJsTypes = [
	"UserStatus",
	"UserRole",
	"PartnerStatus",
	"PartnerType",
	"PartnershipState",
	"WwshopAccess",
	"WwshopType",
	"ConsumerGroupId",
	"SellerGroup",
	"Market",
	"NatCateID",
	"SaleChannel",
	"PublishWhat",
	"DeployWhat",
	"DeployResult",
	"SuppState",
	"SaleState",
	"Supplying",
	"GuidePrices",
	"PrcMode",
	"ConsumerGrade",
	"AddressType",
	"ConsumerGradeSaleInfo",
	"DeliveryWay",
	"DeliveryPaytime",
	"DeliveryChargeType",
	"OrdrState",
	"ClaimState",
	"ClaimHist",
	"CallState",
	"CallType",
	"AssembleState",
	"InvoiceState",
	"BoxingState",
	"Invoice",
	"InvoiceCo",
	"DiscountMode",
	"ProdDraftStatus",
	"IssueState",
	"IssueOpenLevel",
	"IssueThreadType",
	"PayInfo",
	"DeliveryProduct",
	"DeliveryPlan",
	"CompanyType",
	"StdIndustrialGroup",
	"BOOK",
	"DEFER",
];

export const CustomHarvests: {[name: string]: (f: IField, srcObj: string, destObj: string) => string} = {
	"ClaimHist[]": (f: IField, srcObj: string, destObj: string): string => {
		return `
			if (_.isObject(${srcObj}.${f.name})) ${destObj}.${f.name} = ${srcObj}.${f.name};
			else if (_.isString(${srcObj}.${f.name})) ${destObj}.${f.name} = JSON.parse(${srcObj}.${f.name})	
			_.each(${destObj}.${f.name}, (h) => {
				if (_.isString(h.date)) h.date = new Date(h.date);
			});
		`;
	}
};

function resolveFieldType(type: string): string {
	if (type.match(/^UINT(\([0-9]+\))?$/)) return type.replace(/^UINT/, 'INT') + ' UNSIGNED';
	if (type.match(/^TINYUINT(\([0-9]+\))?$/)) return type.replace(/^TINYUINT/, 'TINYINT') + ' UNSIGNED';
	if (type.match(/^SMALLUINT(\([0-9]+\))?$/)) return type.replace(/^SMALLUINT/, 'SMALLINT') + ' UNSIGNED';
	if (type.match(/^BIGUINT(\([0-9]+\))?$/)) return type.replace(/^BIGUINT/, 'BIGINT') + ' UNSIGNED';
	return type;
}

function jsTypeFrom(type: string) {
	if (type.match(/^INT(\([0-9]+\))?(\sUNSIGNED)?$/)) return 'number';
	if (type.match(/^TINYINT(\([0-9]+\))?(\sUNSIGNED)?$/)) return 'number';
	if (type.match(/^SMALLINT(\([0-9]+\))?(\sUNSIGNED)?$/)) return 'number';
	if (type.match(/^BIGINT(\([0-9]+\))?(\sUNSIGNED)?$/)) return 'number';
	if (type.match(/^NUMERIC\([0-9]+,[0-9]+\)(\sUNSIGNED)?$/)) return 'number';

	if (type === 'TEXT') return 'string';
	if (type.match(/CHAR\(.*\)/)) return 'string';

	if (/DATETIME(\([0-6]\))?/.test(type)) return 'Date';
	if (type === 'DATE') return 'string';
	if (type === 'JSON') return '{[name: string]: any}';

	throw new Error('Unexpected field type: ' + type);
}

function makeEntityName(name: string): string {
	const camel = _.camelCase(name);
	return camel.charAt(0).toUpperCase() + camel.substring(1);
}

export function FIELD(name: string, type: string, constraints: string[], options?: {desc?: string, jstype?: string}): IField {
	_.each(constraints, (constraint) => {
		if (constraint === 'NOT NULL') return;
		if (constraint === 'PRIMARY KEY') return;
		if (constraint === 'AUTO_INCREMENT') return;
		throw new Error(`Unexpected constraint: ${constraint}`);
	});

	type = resolveFieldType(type);

	const field = {
		name,
		type,
		notnull: (constraints && constraints.indexOf('NOT NULL') >= 0) ? true : false,
		pk: (constraints && constraints.indexOf('PRIMARY KEY') >= 0) ? true : false,
		auto_increment: (constraints && constraints.indexOf('AUTO_INCREMENT') >= 0) ? true : false,
		jstype: (options && options.jstype) || jsTypeFrom(type),
		desc: options && options.desc
	};
	return field;
}

type FieldArg = [string, string, string[], {desc?: string, jstype?: string}?];
export const TABLE = (options: {name: string, desc?: string, fetchLock?: boolean}, fieldArgsList: FieldArg[], constraints?: string[]): ITable => {
	return {
		name: options.name,
		entityName: makeEntityName(options.name),
		desc: options && options.desc,
		fields: _.map(fieldArgsList, (args) => {
			return FIELD(args[0], args[1], args[2], args[3]);
		}),
		constraints,
		fetchLock: options && options.fetchLock,
	};
};
