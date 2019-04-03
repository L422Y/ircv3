/** @private */
interface ObjectCtor extends ObjectConstructor {
	assign<T>(target: {}, ...source: Array<Partial<T>>): T;

	entries<T, Obj>(o: Obj): Array<[Extract<keyof Obj, string>, T]>;

	keys<Obj>(o: Obj): Array<keyof Obj>;
}

declare let Object: ObjectCtor;

/** @private */
export type ObjMap<Obj, T> = Record<Extract<keyof Obj, string>, T>;
/** @private */
export type ObjMapPart<Obj, T> = Partial<ObjMap<Obj, T>>;

/** @private */
export interface UniformObject<T> {
	[name: string]: T;
}

/** @private */
export type KeyMapper<T> = (value: T) => string;

/** @private */
export default class ObjectTools {
	static map<T, O, Obj = UniformObject<T>>(obj: Obj, fn: (value: T, key: Extract<keyof Obj, string>) => O) {
		// tslint:disable-next-line:no-object-literal-type-assertion
		const mapped = Object.entries<T, Obj>(obj).map(([key, value]: [Extract<keyof Obj, string>, T]) => ({ [key]: fn(value, key) } as ObjMapPart<Obj, O>));
		return Object.assign<ObjMap<Obj, O>>({}, ...mapped);
	}

	static keys<Obj>(o: Obj): Array<keyof Obj> {
		return Object.keys(o);
	}

	static indexBy<T>(arr: T[], key: Extract<keyof T, string>): UniformObject<T>;
	static indexBy<T>(arr: T[], keyFn: KeyMapper<T>): UniformObject<T>;
	static indexBy<T>(arr: T[], keyFn: Extract<keyof T, string> | KeyMapper<T>): UniformObject<T> {
		if (typeof keyFn !== 'function') {
			const key = keyFn;
			keyFn = ((value: T) => value[key].toString()) as KeyMapper<T>;
		}
		return this.fromArray<T, T, UniformObject<T>>(arr, val => ({ [(keyFn as KeyMapper<T>)(val)]: val }));
	}

	static fromArray<T, O, Obj>(arr: T[], fn: (value: T) => ObjMapPart<Obj, O>) {
		return Object.assign<ObjMap<Obj, O>>({}, ...arr.map(fn));
	}

	// tslint:disable-next-line:no-any
	static forEach<T, Obj>(obj: Obj, fn: (value: T, key: keyof Obj) => void) {
		Object.entries<T, Obj>(obj).forEach(([key, value]: [keyof Obj, T]) => fn(value, key));
	}
}
