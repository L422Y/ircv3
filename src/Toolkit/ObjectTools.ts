/** @private */
declare interface ObjectCtor extends ObjectConstructor {
	assign<T>(target: {}, ...source: Array<Partial<T>>): T;

	entries<T, Obj>(o: Obj): Array<[Extract<keyof Obj, string>, T]>;
}

/** @private */
declare let Object: ObjectCtor;

/** @private */
export type ObjMap<Obj, T> = { [name in Extract<keyof Obj, string>]: T };
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

	static fromArray<T, O, Obj>(arr: T[], fn: (value: T) => ObjMapPart<Obj, O>) {
		return Object.assign<ObjMap<Obj, O>>({}, ...arr.map(fn));
	}

	static forEach<T, Obj>(obj: Obj, fn: (value: T, key: Extract<keyof Obj, string>) => void) {
		Object.entries(obj).forEach(([key, value]: [Extract<keyof Obj, string>, T]) => fn(value, key));
	}
}
