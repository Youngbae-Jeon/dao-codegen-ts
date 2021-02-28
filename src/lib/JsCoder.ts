import _ from 'lodash';

function tabs(tabCount: number): string {
	let str = '';
	for (let i = 0; i < tabCount; i++) str += '\t';

	return str;
}

type Line = [number, string];

export class JsCoder {
	private lineList: Line[] = [];
	private tabCount: number = 0;

	add(...lines: string[]) {
		for (let line of lines) {
			if (_.isString(line)) {
				line = line.replace(/^[\t\r\n]*/, '').replace(/[\t\r\n]*$/, '');
				if (line.includes('\n')) {
					_.each(line.split('\n'), (line) => {
						this.addText(line);
					});
				} else {
					this.addText(line);
				}
			}
		}

		return this;
	}

	br(times?: number) {
		if (times) {
			for (let i = 0; i < times; i++) {
				this.add('');
			}

		} else {
			this.add('');
		}

		return this;
	}

	private addText(text: string) {
		text = text.replace(/^[\t\r\n]*/, '').replace(/[\t\r\n]*$/, '')

		const openers = text.match(/[\{\(]/g);
		const closers = text.match(/[\}\)]/g);

		const openCount = openers && openers.length || 0;
		const closeCount = closers && closers.length || 0;

		if (text.match(/^[\}\)]/)) {
			if (--this.tabCount < 0) this.tabCount = 0;
			this.lineList.push([this.tabCount, text]);
			if (openCount > (closeCount - 1)) {
				this.tabCount++;
			}

		} else if (openCount > closeCount) {
			this.lineList.push([this.tabCount, text]);
			this.tabCount++;

		} else if (openCount < closeCount) {
			if (--this.tabCount < 0) this.tabCount = 0;
			this.lineList.push([this.tabCount, text]);

		} else {
			this.lineList.push([this.tabCount, text]);
		}
	}

	tab(line?: string) {
		if (line) this.add(line);
		this.tabCount++;
		return this;
	}

	untab(line?: string) {
		if (--this.tabCount < 0) this.tabCount = 0;
		if (line) this.add(line);
		return this;
	}

	length(): number {
		return this.lineList.length
	}

	getLines(): string[] {
		return this.lineList.map(([tabCount, text]) => {
			if (text) {
				return tabs(tabCount) + text;
			} else {
				return '';
			}
		});
	}

	toString(): string {
		return this.getLines().join('\n');
	}
}
