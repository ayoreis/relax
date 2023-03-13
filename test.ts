const test = {
	[Symbol.match]() {
		return true;
	},
};

type ReturnTypeOfSymbol<T> = T extends
	{ [Symbol.match]: () => infer Return } ? Return : never;

type Test = ReturnTypeOfSymbol<typeof test>;
