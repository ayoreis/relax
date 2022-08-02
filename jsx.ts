const SELF_CLOSING_ELEMENTS = [
    'area',
    'base',
    'basefont',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'keygen',
    'link',
    'meta',
    'param',
    'source',
    'spacer',
    'track',
    'wbr',
]

export async function jsx(
    tagName: string,
    { children: unprocessedChildren, ...unprocessedAttributes }: any = {},
    ...devParameters: any
) {
    const isComponent = tagName.includes('-')
    const isSelfClosing = SELF_CLOSING_ELEMENTS.includes(tagName.toLowerCase())
    const attributes = Object.entries(unprocessedAttributes).map(([ key, value ]) => `${ key }="${ value }"`).join(' ') ?? ''
    const children = Array.isArray(unprocessedChildren) ? await Promise.all(unprocessedChildren.map(async (child) => await child)).join() : await unprocessedChildren ?? ''
    let componentChildren

    if (isComponent) {
        componentChildren = await componentsByTagName[ tagName ](unprocessedAttributes)
    }

    return `<${ tagName }${ attributes && ' ' + attributes }>${ !isSelfClosing ? (isComponent ? componentChildren : children) + `</${ tagName }>` : '' }`
}

export { jsx as jsxs, jsx as jsxDEV }