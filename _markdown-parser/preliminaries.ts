// 2. https://spec.commonmark.org/0.30/#preliminaries

// TODO multiline flag
/** 2. https://spec.commonmark.org/0.30/#line-ending */
export const LINE_ENDING = /.*(?:\n|\r\n?)|.+$|^$/g;
/** 2. https://spec.commonmark.org/0.30/#blank-line */
export const BLANK_LINE = /^[ \t]*\r?\n?$/;
