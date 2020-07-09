import { Commands } from '../Message/MessageTypes';

export class MessageError extends Error {
	readonly ircMessage: Commands.ErrorMessage;

	constructor(msg: Commands.ErrorMessage) {
		super(`Received error from IRC server: ${msg.rawLine}`);

		this.ircMessage = msg;

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	get name() {
		return this.constructor.name;
	}
}
