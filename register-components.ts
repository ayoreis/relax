import {
    esbuild,
    denoPlugin,
    path
} from './dependencies.ts'

import { build } from './build.ts'

declare global {
    var componentsByTagName: any
    var componentsByFilepath: any
}

globalThis.componentsByTagName = new Map()
globalThis.componentsByFilepath = new Map()

export async function registerComponents(filepaths: string[]) {
    Deno.run ?? esbuild.initialize({ worker: false })

    for (const filepath of filepaths) {
        const source = build(await Deno.readTextFile(filepath))
        
        const result = await esbuild.build({
            bundle: true,
            write: false,
            globalName: 'result',
            jsx: 'automatic',
            jsxImportSource: 'relax',

            stdin: {
                contents: source,
                sourcefile: `${path.toFileUrl(Deno.cwd()).href}/${filepath}`,
                loader: 'tsx',
            },

            plugins: [ denoPlugin({
                importMapURL: new URL('./jsx-runtime-import-map.json', import.meta.url)
            }) ],
        })

        const runable = result.outputFiles[ 0 ].text.replace('var result =', 'return')
        const exports = new Function(runable)()

        componentsByTagName[ exports.default.tagName ] = exports.default.function
        componentsByFilepath[ filepath ] = exports.default.function
    }

    esbuild.stop()
}