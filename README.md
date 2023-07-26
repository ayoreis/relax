<div align="center">

# Relax

For making websites

[Documentation](https://github.com/ayoreis/relax/wiki) × [Registry](https://deno.land/x/relax) × [API](https://deno.land/x/relax?doc) × [Source](https://github.com/ayoreis/relax) × [Discord][Discord] × [Figma](https://www.figma.com/file/3myIn1Wy6vaF7atUwasMPU/Relax?type=design&node-id=0-1&mode=design&t=m4lIDItLqaws1rSI-0)

</div>

<br>

```typescript
import { Router } from 'relax/router.ts';

const router = new Router();

router.any('*', function* () {
	console.time();
	yield;
	console.timeEnd();
});

router.get('/', () => {
	return new Response('Hello world');
});
```

## Contributing

We have a `#dev` channel in [Discord][Discord].

Deno is used for formatting, linting and testing.

We use [Conventional Commits](https://www.conventionalcommits.org/) (description capitalized) and [Semantic Versioning](https://semver.org).

<details>
<summary>

## Todo and ideas</summary>

<details>
<summary>Router</summary>

- [x] Server side
  - [ ] Typed URL parameters
- [ ] Client side
  - [ ] [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)
- [ ] File system?
- [ ] Benchmark
  - [ ] [Im-Beast/http_benchmarks](https://github.com/Im-Beast/http_benchmarks)
  - [ ] [denosaurs/bench](https://github.com/denosaurs/bench)
- [ ] Builtin Handlers
  - [ ] Trailing slashes
  - [ ] `example.com` > `www.example.com`
  - [ ] `www.example.com` > `example.com`
- [ ] Component (eg React Router)

</details>

<details>
<summary>Components (compiler)</summary>

- [ ] Web Components
- [ ] Frontmatter parser
- [ ] Mustache compiler
- [ ] JavaScript parser
- [ ] Frontmatter specification

</details>

<details>
<summary>Templating</summary>

- [ ] Markdown parser
- [ ] HTML parser

</details>

<details>
<summary>Reactivity</summary>

```typescript
const count = reactive(0);

effect(() => {
	console.log(count);
});

count(count++);
```

</details>

<details>
<summary>Data</summary>

Something like tRPC?

</details>

---

Here are external things things which would benefit Relax, I want to contribute/propose/create them.

<!---->

- [ ] Propose: Python-Pickle like serialization.
- [ ] Propose: JSX/E4X/HTML-in-JS + template literals extension (template objects)
- [ ] Contribute: Native Deno DOM, denoland/deno#3648, denoland/deno#3447, denoland/deno#7505, denoland/deno#6794, denoland/deno#7527
- [ ] Create: Dynamic import ponyfill
  - [ ] denoland/deno#15482, denoland/deno#19322

<!---->

- `URLPatternList` (native routing)
  - [ ] WICG/urlpattern#30
  - [ ] WICG/urlpattern#166
  - [ ] WICG/urlpattern#61

<!---->

- Decorators
  - [ ] [tc39/proposal-decorator-metadata](https://github.com/tc39/proposal-decorator-metadata)
  - [ ] [tc39/proposal-class-method-parameter-decorators](https://github.com/tc39/proposal-class-method-parameter-decorators)
  - [ ] [tc39/proposal-decorators/EXTENSIONS.md](https://github.com/tc39/proposal-decorators/blob/master/EXTENSIONS.md)

<!---->

- [ ] [webqit/reflex-functions](https://github.com/webqit/reflex-functions)
- [ ] [samuelgoto/proposal-block-params](https://github.com/samuelgoto/proposal-block-params)
- [ ] [tc39/proposal-compartments](https://github.com/tc39/proposal-compartments)
- [ ] [tc39/proposal-type-annotations](https://github.com/tc39/proposal-type-annotations)
- [ ] [tc39/proposal-do-expressions](https://github.com/tc39/proposal-do-expressions)
- [ ] [tc39/proposal-async-do-expressions](https://github.com/tc39/proposal-async-do-expressions)

<!---->

- [ ] WICG/urlpattern#61
- [ ] WICG/webcomponents#939
- [ ] WICG/webcomponents#909
- [ ] whatwg/html#2142

[discord]: https://discord.gg/24AyvbBKcJ
