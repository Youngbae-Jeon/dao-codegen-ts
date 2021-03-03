import _ from 'lodash';
import util from 'util';


type Symbol = '<' | '>' | '{' | '}' | '[' | ']' | '|' | ':' | '.' | ',';

interface Expression {
	expr: 'chained_type' | 'name_type_pair' | 'string' | 'number' | 'keyword' | 'unknown' | Symbol,
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

	endupBuffer(ch?: string) {
		if (ch) this.buffer.push(ch);
		if (this.buffer.length) {
			const token = this.buffer.join('');
			this.tokens.push(this.expression(token));
			this.buffer = [];
		}
	}

	expression(token: string): Expression {
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

	parse() {
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
		let found = this.findChainedType(parsed);
		if (found) return found;

		found = this.findNameTypePair(parsed);
		if (found) return found;
	}

	private findChainedType(parsed: Expression[]): {expr: Expression, begin: number, count: number} | undefined {
		for (let i = 2; i < parsed.length; i++) {
			if (parsed[i - 1].expr === '.') {
				const lhs = parsed[i - 2];
				const rhs = parsed[i];
				if (lhs.expr === 'chained_type' && (rhs.expr === 'unknown' || rhs.expr === 'keyword')) {
					return {
						expr: { expr: 'chained_type', tokens: [...lhs.tokens!, rhs]},
						begin: i - 2,
						count: 3
					}
				} else if ((lhs.expr === 'unknown' || rhs.expr === 'keyword') && rhs.expr === 'chained_type') {
					return {
						expr: { expr: 'chained_type', tokens: [lhs, ...rhs.tokens!]},
						begin: i - 2,
						count: 3
					}
				} else if ((lhs.expr === 'unknown' || lhs.expr === 'keyword') && (rhs.expr === 'unknown' || rhs.expr === 'keyword')) {
					return {
						expr: { expr: 'chained_type', tokens: lhs.tokens!.concat(rhs.tokens!)},
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
					(rhs.expr === 'unknown' || rhs.expr === 'keyword' || rhs.expr === 'chained_type')) {
					return {
						expr: { expr: 'name_type_pair', tokens: [lhs, rhs]},
						begin: i - 2,
						count: 3
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
		console.log('parsed:', util.inspect(parsed, false, null, true));

		if (onUnknownType) {
			this.findInExpression(parsed, onUnknownType);
		};
		return parsed;
	}

	static findInExpression(expressions: Expression[], onType: (type: string) => void) {
		expressions.forEach(expr => {
			if (expr.expr === 'unknown' || expr.expr === 'chained_type') {
				console.log('*** unknown type:', expr.tokens![0])
				onType(expr.tokens![0] as string);

			} else if (expr.expr === 'name_type_pair') {
				this.findInExpression([expr.tokens![1] as Expression], onType);
			}
		})
	}
}
