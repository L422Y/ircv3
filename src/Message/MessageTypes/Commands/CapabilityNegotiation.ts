import Message, { MessageParam, MessageParamSpec } from '../../Message';

export interface CapabilityNegotiationParams {
	target: MessageParam;
	command: MessageParam;
	version: MessageParam;
	continued: MessageParam;
	capabilities: MessageParam;
}

export default class CapabilityNegotiation extends Message<CapabilityNegotiationParams> {
	public static readonly COMMAND = 'CAP';
	public static readonly PARAM_SPEC: MessageParamSpec<CapabilityNegotiationParams> = {
		target: {
			match: /^(?:[a-z_\-\[\]\\^{}|`][a-z0-9_\-\[\]\\^{}|`]*|\*)$/i,
			optional: true
		},
		command: {
			match: /^(?:LS|LIST|REQ|ACK|NAK|END|NEW|DEL)$/i,
		},
		version: {
			match: /^\d+$/,
			optional: true
		},
		continued: {
			match: /^\*$/,
			optional: true
		},
		capabilities: {
			trailing: true,
			optional: true
		}
	};

	public static readonly SUPPORTS_CAPTURE = true;

	protected isResponseTo(originalMessage: Message): boolean {
		if (!(originalMessage instanceof CapabilityNegotiation)) {
			return false;
		}

		switch (this.params.command) {
			case 'ACK':
			case 'NAK': {
				// trim is necessary because some networks seem to add trailing spaces (looking at you, Freenode)...
				return originalMessage.params.command === 'REQ'
					&& originalMessage.params.capabilities === this.params.capabilities.trim();
			}

			case 'LS':
			case 'LIST': {
				return originalMessage.params.command === this.params.command;
			}

			default: {
				return false;
			}
		}
	}

	public endsResponseTo(originalMessage: Message): boolean {
		if (!(originalMessage instanceof CapabilityNegotiation)) {
			return false;
		}

		switch (this.params.command) {
			case 'LS':
			case 'LIST': {
				return !this.params.continued;
			}

			default: {
				return true;
			}
		}
	}
}
