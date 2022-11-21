<h1 align="center">Relax</h1>
<h6 align="center">For making websites</h6>
<p align="center">~~~~~~~</p>

I'm working on a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)–[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)-router ([`Check it out!`](/router/router.ts)), and on a HTML Parser that uses [Template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) and keep element references, eg

```ts
const name = template`<span>🐶 Dog</span>`
const greeting = template`<h1>Hi ${name}! Welcome to Relax.</h1>`

name.textContent = '😸 Cat'

console.log(greeting) // <h1>Hi <span>😸 Cat</span>! Welcome to Relax.</h1>
```

It's not ready yet but the code's at [/templating](/templating).

Check out [ayoreis.com](//ayoreis.com) for a website using this!

---

_Made by [Ayo](//ayoreis.com) with 💖._
