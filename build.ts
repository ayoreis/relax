import {
    DOMParser,
    fromJs,
    jsxPlugin,
    stage3Plugin,
    toJs,
    jsxHandler,
} from './dependencies.ts'

const fromOptions = {
    module: true,
    allowAwaitOutsideFunction: true,
    plugins: [ jsxPlugin(), stage3Plugin, ],
}

const toOptions = {
    handlers: jsxHandler,
}

export function build(source: string) {
    const vdom = new DOMParser().parseFromString(source, 'text/html')!
    const componentVdom = vdom.body.querySelector(':first-child')!
    const { tagName } = componentVdom
    const scriptVdom = componentVdom.querySelector('script')!
    const templateVdom = componentVdom.querySelector('template')!
    const parameters = [ ...componentVdom.attributes ].map(({ nodeName, value, }) => `${ nodeName } = '${ value }'`).join(', ')

    const ast = fromJs(`
    export default {
        tagName: '${ tagName.toLowerCase() }',
        async function(${ parameters }) {},
    }
    `, fromOptions)

    const scriptAst = fromJs(scriptVdom.innerHTML, fromOptions)
    const templateAst = fromJs(templateVdom.innerHTML, fromOptions)
    const importNodes = []
    const otherNodes = []

    for (const node of scriptAst.body) {
        if (node.type === 'ImportDeclaration') {
            importNodes.push(node)
            continue
        }

        otherNodes.push(node)
    }

    ast.body[ 0 ].declaration.properties[ 1 ].value.body.body.push(
        ...otherNodes,

        {
            type: 'ReturnStatement',
            argument: templateAst.body[ 0 ].expression
        },
    )

    ast.body.unshift(...importNodes)

    return toJs(ast, toOptions).value
}

if (import.meta.main) {
    const source = `
    <welcome-message name="John Doe">
        <script>
            import { sayWelcome } from 'greetings'

            const message = sayWelcome(name)
        </script>

        <template>
            <h1>{ message }</h1>
        </template>
    </welcome-message>
    `

    console.log(build(source))
}