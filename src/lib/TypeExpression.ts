import _ from 'lodash';
import util from 'util';


type Symbol = '<' | '>' | '{' | '}' | '[' | ']' | '|' | ':' | '.' | ',';

interface Expression {
	expr: 'chained_list' | 'piped_list' | 'name_type_pair' | 'name_type_pair_list' | 'plain_object' | 'tailed_array' | 'generic' | 'generic_type_list' | 'string' | 'number' | 'keyword' | 'unknown' | Symbol,
	tokens?: Array<string | Expression>
}

class Tokenizer {
	constructor(private expr: string) {}

	private buffer!: string[];
	private tokens!: Expression[];

	tokenize(): Expression[] {
		this.buffer = [];
		this.tokens = [];

		for (const ch of this.expr) {
			if ((this.buffer[0] === '\'' && ch === '\'') ||
				(this.buffer[0] === '"' && ch === '"')) {
				this.endupBuffer(ch);

			} else {
				switch (ch) {
					case '<':
					case '>':
					case '{':
					case '}':
					case '[':
					case ']':
					case '|':
					case ':':
					case '.':
					case ',':
						this.endupBuffer();
						this.endupBuffer(ch);
						break;

					case ' ':
						this.endupBuffer();
						break;

					case '\'':
					case '"':
					default:
						this.buffer.push(ch);
						break;
				}
			}
		}
		this.endupBuffer();

		return this.tokens;
	}

	private endupBuffer(ch?: string) {
		if (ch) this.buffer.push(ch);
		if (this.buffer.length) {
			const token = this.buffer.join('');
			this.tokens.push(this.expression(token));
			this.buffer = [];
		}
	}

	private expression(token: string): Expression {
		switch (token) {
			case '<':
			case '>':
			case '{':
			case '}':
			case '[':
			case ']':
			case '|':
			case ':':
			case '.':
			case ',':
				return {expr: token};
			default:
				if ((token.startsWith('\'') && token.endsWith('\'')) ||
					(token.startsWith('\'') && token.endsWith('\''))) return { expr: 'string', tokens: [token] };
				else if (/^[0-9]+(\.[0-9]+)?$/.test(token)) return { expr: 'number', tokens: [token] };
				else if (/^\.[0-9]+$/.test(token)) return { expr: 'number', tokens: [token] };
				else return { expr: 'unknown', tokens: [token] };
		}
	}
}

class Parser {
	constructor(private tokens: Expression[]) {}

	parse(): Expression[] {
		let parsed: Expression[] = this.tokens;

		for (;;) {
			const found = this.findExpression(parsed)
			if (found) {
				parsed.splice(found.begin, found.count, found.expr);
				continue;
			}

			break;
		}

		return parsed;
	}

	private findExpression(parsed: Expression[]): {expr: Expression, begin: number, count: number} | undefined {
		let found: {expr: Expression, begin: number, count: number} | undefined;

		found = this.findChainedList(parsed);
		if (found) return found;

		found = this.findTailedArray(parsed);
		if (found) return found;

		found = this.findGenericTypeList(parsed);
		if (found) return found;

		found = this.findGeneric(parsed);
		if (found) return found;

		found = this.findPipedList(parsed);
		if (found) return found;

		found = this.findNameTypePair(parsed);
		if (found) return found;

		found = this.findNameTypePairList(parsed);
		if (found) return found;

		found = this.findPlainObject(parsed);
		if (found) return found;
	}

	private findChainedList(parsed: Expression[]): {expr: Expression, begin: number, count: number} | undefined {
		for (let i = 2; i < parsed.length; i++) {
			if (parsed[i - 1].expr === '.') {
				const lhs = parsed[i - 2];
				const rhs = parsed[i];
				if (lhs.expr === 'chained_list' && (rhs.expr === 'unknown' || rhs.expr === 'keyword')) {
					return {
						expr: { expr: 'chained_list', tokens: [...lhs.tokens!, rhs]},
						begin: i - 2,
						count: 3
					}
				} else if ((lhs.expr === 'unknown' || lhs.expr === 'keyword') && (rhs.expr === 'unknown' || rhs.expr === 'keyword')) {
					return {
						expr: { expr: 'chained_list', tokens: [lhs, rhs]},
						begin: i - 2,
						count: 3
					}
				}
			}
		}
	}

	private findTailedArray(parsed: Expression[]): {expr: Expression, begin: number, count: number} | undefined {
		for (let i = 2; i < parsed.length; i++) {
			if (parsed[i - 1].expr === '[' && parsed[i].expr === ']') {
				const lhs = parsed[i - 2];
				if (['unknown', 'keyword', 'chained_list', 'plain_object', 'tailed_array', 'generic'].includes(lhs.expr)) {
					return {
						expr: { expr: 'tailed_array', tokens: [lhs]},
						begin: i - 2,
						count: 3
					}
				}
			}
		}
	}

	private findPipedList(parsed: Expression[]): {expr: Expression, begin: number, count: number} | undefined {
		for (let i = 2; i < parsed.length; i++) {
			if (parsed[i - 1].expr === '|') {
				const lhs = parsed[i - 2];
				const rhs = parsed[i];
				if (lhs.expr === 'piped_list' && ['unknown', 'keyword', 'chained_list', 'plain_object', 'tailed_array', 'generic', 'string', 'number'].includes(rhs.expr)) {
					return {
						expr: { expr: 'piped_list', tokens: [...lhs.tokens!, rhs]},
						begin: i - 2,
						count: 3
					}
				} else if (['unknown', 'keyword', 'chained_list', 'plain_object', 'tailed_array', 'generic', 'string', 'number'].includes(lhs.expr)
					&& ['unknown', 'keyword', 'chained_list', 'plain_object', 'tailed_array', 'generic', 'string', 'number'].includes(rhs.expr)) {
					return {
						expr: { expr: 'piped_list', tokens: [lhs, rhs]},
						begin: i - 2,
						count: 3
					}
				}
			}
		}
	}

	private findNameTypePair(parsed: Expression[]): {expr: Expression, begin: number, count: number} | undefined {
		for (let i = 2; i < parsed.length; i++) {
			if (parsed[i - 1].expr === ':') {
				const lhs = parsed[i - 2];
				const rhs = parsed[i];
				if ((lhs.expr === 'unknown' || rhs.expr === 'keyword') &&
					['unknown', 'keyword', 'chained_list', 'piped_list', 'plain_object', 'tailed_array', 'generic', 'string', 'number'].includes(rhs.expr)) {
					return {
						expr: { expr: 'name_type_pair', tokens: [lhs, rhs]},
						begin: i - 2,
						count: 3
					}
				}
			}
		}
	}

	private findNameTypePairList(parsed: Expression[]): {expr: Expression, begin: number, count: number} | undefined {
		for (let i = 2; i < parsed.length; i++) {
			if (parsed[i - 1].expr === ',') {
				const lhs = parsed[i - 2];
				const rhs = parsed[i];
				if (lhs.expr === 'name_type_pair_list' && rhs.expr === 'name_type_pair') {
					return {
						expr: { expr: 'name_type_pair_list', tokens: [...lhs.tokens!, rhs]},
						begin: i - 2,
						count: 3
					}
				} else if (lhs.expr === 'name_type_pair' && rhs.expr === 'name_type_pair') {
					return {
						expr: { expr: 'name_type_pair_list', tokens: [lhs, rhs]},
						begin: i - 2,
						count: 3
					}
				}
			}
		}
	}

	private findPlainObject(parsed: Expression[]): {expr: Expression, begin: number, count: number} | undefined {
		for (let i = 2; i < parsed.length; i++) {
			if (parsed[i - 2].expr === '{' && parsed[i].expr === '}') {
				const center = parsed[i - 1];
				if (center.expr === 'name_type_pair_list') {
					return {
						expr: { expr: 'plain_object', tokens: [...center.tokens!]},
						begin: i - 2,
						count: 3
					}
				} else if (center.expr === 'name_type_pair') {
					return {
						expr: { expr: 'plain_object', tokens: [center]},
						begin: i - 2,
						count: 3
					}
				}
			}
		}
	}

	private findGenericTypeList(parsed: Expression[]): {expr: Expression, begin: number, count: number} | undefined {
		for (let i = 3; i < parsed.length; i++) {
			if (parsed[i - 1].expr === '<') {
				const lhs = parsed[i - 2];
				const rhs = parsed[i];
				if (['unknown', 'keyword', 'chained_list'].includes(lhs.expr) &&
					['unknown', 'keyword', 'chained_list', 'piped_list', 'plain_object', 'tailed_array', 'generic'].includes(rhs.expr)) {
					return {
						expr: { expr: 'generic_type_list', tokens: [rhs]},
						begin: i,
						count: 1
					};
				}

			} else if (parsed[i - 1].expr === ',') {
				const lhs = parsed[i - 2];
				const rhs = parsed[i];
				if (lhs.expr === 'generic_type_list' && ['unknown', 'keyword', 'chained_list', 'piped_list', 'plain_object', 'tailed_array', 'generic'].includes(rhs.expr)) {
					return {
						expr: { expr: 'generic_type_list', tokens: [...lhs.tokens!, rhs]},
						begin: i - 2,
						count: 3
					};
				}
			}
		}
	}

	private findGeneric(parsed: Expression[]): {expr: Expression, begin: number, count: number} | undefined {
		for (let i = 3; i < parsed.length; i++) {
			if (parsed[i - 2].expr === '<' && parsed[i].expr === '>') {
				const lhs = parsed[i - 3];
				const rhs = parsed[i - 1];
				if (['unknown', 'keyword', 'chained_list'].includes(lhs.expr) && rhs.expr === 'generic_type_list') {
					return {
						expr: { expr: 'generic', tokens: [lhs, rhs]},
						begin: i - 3,
						count: 4
					}
				}
			}
		}
	}
}

export class TypeExpression {
	static parse(expr: string, onUnknownType?: (type: string) => void): Expression[] {
		if (!_.isString(expr)) throw new Error('Argument expr should be a string');

		const tokens = new Tokenizer(expr).tokenize();
		const parsed = new Parser(tokens).parse();
		// console.log('parsed:', util.inspect(parsed, false, null, true));

		if (onUnknownType) {
			this.findInExpression(parsed, onUnknownType);
		};
		return parsed;
	}

	static findInExpression(expressions: Expression[], onType: (type: string) => void) {
		expressions.forEach(expr => {
			if (expr.expr === 'unknown') {
				// console.log('unknown type:', expr.tokens![0])
				onType(expr.tokens![0] as string);

			} else if (expr.expr === 'chained_list') {
				this.findInExpression([expr.tokens![0] as Expression], onType);

			} else if (expr.expr === 'name_type_pair') {
				this.findInExpression([expr.tokens![1] as Expression], onType);

			} else if (expr.expr === 'name_type_pair_list') {
				this.findInExpression([...expr.tokens! as Expression[]], onType);

			} else if (expr.expr === 'piped_list') {
				this.findInExpression([...expr.tokens! as Expression[]], onType);

			} else if (expr.expr === 'plain_object') {
				this.findInExpression([...expr.tokens! as Expression[]], onType);

			} else if (expr.expr === 'tailed_array') {
				this.findInExpression([expr.tokens![0] as Expression], onType);

			} else if (expr.expr === 'generic') {
				this.findInExpression([...expr.tokens! as Expression[]], onType);

			} else if (expr.expr === 'generic_type_list') {
				this.findInExpression([...expr.tokens! as Expression[]], onType);
			}
		})
	}
}
