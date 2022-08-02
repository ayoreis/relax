# relax
The <!-- hybrid (not yet) --> framework like library, for building modern-websites, on the modern-web.

## Example 
> **Note**
> This example works in [Deno Deploy](https://deno.com/deploy).

```tsx
// greetings.ts
export function sayWelcome(name: string) {
    return `😎 Welcome to Relax ${ name }!`
}

// welcome-message.relax
<welcome-message name="Someone on the internet">
    <script>
        import { sayWelcome } from './greetings.ts'

        const message = sayWelcome(name)
    </script>

    <template>
        <h1>{ message }</h1>
    </template>
</welcome-message>

// mod.tsx
import { registerComponents } from 'https://deno.land/x/relax@0.1.0/register-components.ts'
await registerComponents([ 'welcome-message.relax' ])

console.log(await (<welcome-message name="Ayo Reis"></welcome-message>))
```

```json
// deno.json
{
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "relax"
    },

    "importMap": "import-map.json"
}

// import-map.json
{
    "imports": {
        "relax": "https://deno.land/x/relax@0.1.0/jsx.ts", 
        "relax/jsx-runtime": "https://deno.land/x/relax@0.1.0/jsx.ts",
        "relax/jsx-dev-runtime": "https://deno.land/x/relax@0.1.0/jsx.ts"
    }
}
```