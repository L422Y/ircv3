import Client from '../Client';

import ObjectTools from '../Toolkit/ObjectTools';
import { isChannel } from '../Toolkit/StringTools';
import { MessageDataType } from '../Toolkit/TypeTools';

export type MessagePrefix = {
	raw: string;
	nick: string;
	user?: string;
	host?: string;
};

export interface MessageParam {
	value: string;
	trailing: boolean;
}

export interface MessageParamSpecEntry {
	trailing?: boolean;
	rest?: boolean;
	optional?: boolean;
	type?: 'channel';
	match?: RegExp;
}

export type MessageParamSpec<T extends Message = Message> = {
	[name in keyof MessageDataType<T>]: MessageParamSpecEntry
};

export interface MessageConstructor<T extends Message = Message> {
	COMMAND: string;
	PARAM_SPEC: MessageParamSpec<T>;
	SUPPORTS_CAPTURE: boolean;
	minParamCount: number;

	new(
		client: Client, command: string, params?: MessageParam[], tags?: Map<string, string>,
		prefix?: MessagePrefix
	): T;

	create(this: MessageConstructor<T>, client: Client, params: { [name in keyof MessageDataType<T>]?: string }): T;

	checkParam(client: Client, param: string, spec: MessageParamSpecEntry): boolean;
}

const tagEscapeMap: { [char: string]: string } = {
	'\\': '\\',
	':': ';',
	n: '\n',
	r: '\r',
	s: ' '
};

export default class Message<D extends { [name in keyof D]?: MessageParam } = {}> {
	static readonly COMMAND: string = '';
	static readonly PARAM_SPEC = {};
	//noinspection JSUnusedGlobalSymbols
	static readonly SUPPORTS_CAPTURE: boolean = false;

	protected _tags?: Map<string, string>;
	protected _prefix?: MessagePrefix;
	protected _command: string;
	protected _params?: MessageParam[] = [];
	protected _parsedParams!: D;
	protected _client!: Client;

	private _raw?: string;

	static parse(line: string, client: Client): Message {
		const splitLine: string[] = line.split(' ');
		let token: string;

		let command: string | undefined;
		const params: MessageParam[] = [];
		let tags: Map<string, string> | undefined;
		let prefix: MessagePrefix | undefined;

		while (splitLine.length) {
			token = splitLine[0];
			if (token[0] === '@' && !tags && !command) {
				tags = Message.parseTags(token.substr(1));
			} else if (token[0] === ':') {
				if (!prefix && !command) {
					prefix = Message.parsePrefix(token.substr(1));
				} else {
					params.push({
						value: splitLine.join(' ').substr(1),
						trailing: true
					});
					break;
				}
			} else if (!command) {
				command = token.toUpperCase();
			} else {
				params.push({
					value: token,
					trailing: false
				});
			}
			splitLine.shift();
		}

		if (!command) {
			throw new Error(`line without command received: ${line}`);
		}

		let message: Message;

		let messageClass: MessageConstructor = Message;
		if (client.knowsCommand(command)) {
			messageClass = client.getCommandClass(command)!;
		}

		// tslint:disable-next-line:no-inferred-empty-object-type
		message = new messageClass(client, command, params, tags, prefix);
		message._raw = line;

		return message;
	}

	static parsePrefix(raw: string): MessagePrefix {
		const [nick, hostName] = raw.split('!', 2);
		if (hostName) {
			const [user, host] = hostName.split('@', 2);
			if (host) {
				return { raw, nick, user, host };
			} else {
				return { raw, nick, host: user };
			}
		} else {
			return { raw, nick };
		}
	}

	static parseTags(raw: string): Map<string, string> {
		const tags: Map<string, string> = new Map();
		const tagStrings = raw.split(';');
		for (const tagString of tagStrings) {
			const [tagName, tagValue] = tagString.split('=', 2);
			// unescape according to http://ircv3.net/specs/core/message-tags-3.2.html#escaping-values
			tags.set(tagName, tagValue.replace(/\\([\\:nrs])/g, (_, match) => tagEscapeMap[match]));
		}

		return tags;
	}

	static create<T extends Message>(
		this: MessageConstructor<T>,
		client: Client,
		params: { [name in keyof MessageDataType<T>]?: string }
	): T {
		const message: T = new this(client, this.COMMAND);
		const parsedParams: { [name in keyof MessageDataType<T>]?: MessageParam } = {};
		ObjectTools.forEach(this.PARAM_SPEC, (paramSpec: MessageParamSpecEntry, paramName: keyof MessageDataType<T>) => {
			if (paramName in params) {
				const param = params[paramName];
				if (this.checkParam(client, param!, paramSpec)) {
					parsedParams[paramName] = {
						value: param!,
						trailing: Boolean(paramSpec.trailing)
					};
				} else if (!paramSpec.optional) {
					throw new Error(`required parameter "${paramName}" did not suit requirements: "${param}"`);
				}
			}
			if (!(paramName in parsedParams) && !paramSpec.optional) {
				throw new Error(`required parameter "${paramName}" not found in command "${this.COMMAND}"`);
			}
		});

		message._parsedParams = parsedParams;

		return message;
	}

	static checkParam(client: Client, param: string, spec: MessageParamSpecEntry): boolean {
		if (spec.type === 'channel') {
			if (!isChannel(param, client.channelTypes)) {
				return false;
			}
		}

		if (spec.match) {
			if (!spec.match.test(param)) {
				return false;
			}
		}

		return true;
	}

	toString(): string {
		const cls = this.constructor as MessageConstructor<this>;
		const specKeys = ObjectTools.keys(cls.PARAM_SPEC);
		return [this._command, ...specKeys.map((paramName): string | undefined => {
			const param = this._parsedParams[paramName];
			if (param) {
				return (param.trailing ? ':' : '') + param.value;
			}
		}).filter((param: string | undefined) => param !== undefined)].join(' ');
	}

	constructor(
		client: Client, command: string, params?: MessageParam[], tags?: Map<string, string>, prefix?: MessagePrefix) {
		this._command = command;
		this._params = params;
		this._tags = tags;
		this._prefix = prefix;

		Object.defineProperty(this, '_client', {
			get: () =>
				client
		});

		this.parseParams();
	}

	parseParams() {
		if (this._params) {
			const cls = this.constructor as MessageConstructor<this>;
			let requiredParamsLeft = cls.minParamCount;
			if (requiredParamsLeft > this._params.length) {
				throw new Error(
					`command "${this._command}" expected ${requiredParamsLeft} or more parameters, got ${this._params.length}`
				);
			}

			const paramSpecList = cls.PARAM_SPEC;
			let i = 0;
			const parsedParams: { [name in keyof D]?: MessageParam } = {};
			for (const [paramName, paramSpec] of Object.entries<MessageParamSpecEntry>(paramSpecList)) {
				if ((this._params.length - i) <= requiredParamsLeft) {
					if (paramSpec.optional) {
						continue;
					} else if (this._params.length - i !== requiredParamsLeft) {
						throw new Error(
							'not enough parameters left for required parameters parsing (this is a library bug)'
						);
					}
				}
				let param: MessageParam = this._params[i];
				if (!param) {
					if (paramSpec.optional) {
						break;
					}

					throw new Error('unexpected parameter underflow');
				}

				if (paramSpec.rest) {
					const restParams = [];
					while (this._params[i] && !this._params[i].trailing) {
						restParams.push(this._params[i].value);
						++i;
					}
					if (!restParams.length) {
						if (paramSpec.optional) {
							continue;
						}
						throw new Error(`no parameters left for required rest parameter "${paramName}"`);
					}
					param = {
						value: restParams.join(' '),
						trailing: false
					};
				}
				if (this.checkParam(param.value, paramSpec)) {
					parsedParams[paramName as keyof MessageParamSpec<this>] = { ...param };
					if (!paramSpec.optional) {
						--requiredParamsLeft;
					}
					if (!paramSpec.rest) {
						++i;
					}
				} else if (!paramSpec.optional) {
					throw new Error(`required parameter "${paramName}" (index ${i}) did not suit requirements: "${param.value}"`);
				}

				if (paramSpec.trailing) {
					break;
				}
			}

			this._parsedParams = parsedParams as D;
		}
	}

	checkParam(param: string, spec: MessageParamSpecEntry): boolean {
		const cls = this.constructor as MessageConstructor<this>;
		return cls.checkParam(this._client, param, spec);
	}

	static get minParamCount(): number {
		return Object.values(this.PARAM_SPEC).filter((spec: MessageParamSpecEntry) => !spec.optional).length;
	}

	get params(): { [name in Extract<keyof D, string>]: string } {
		return ObjectTools.map(this._parsedParams, (param: MessageParam) => param.value);
	}

	get prefix(): MessagePrefix | undefined {
		return this._prefix && { ...this._prefix };
	}

	get command(): string {
		return this._command;
	}

	get tags(): Map<string, string> {
		return new Map(this._tags || []);
	}

	get rawLine() {
		return this._raw;
	}

	send(): void {
		this._client.send(this);
	}

	async sendAndCaptureReply(): Promise<Message[]> {
		const cls = this.constructor as MessageConstructor<this>;

		if (!cls.SUPPORTS_CAPTURE) {
			throw new Error(`The command "${cls.COMMAND}" does not support reply capture`);
		}

		const promise = this._client.collect(this).promise();
		this.send();
		return promise;
	}

	protected isResponseTo(originalMessage: Message): boolean {
		return false;
	}

	endsResponseTo(originalMessage: Message): boolean {
		return false;
	}

	_acceptsInReplyCollection(message: Message): boolean {
		// TODO implement IRCv3 labeled-response / batch here
		return message.isResponseTo(this);
	}
}
