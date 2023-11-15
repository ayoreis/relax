// 2. https://spec.commonmark.org/0.30/#preliminaries

/** 2.1. https://spec.commonmark.org/0.30/#line */
export const LINE = /(?<=^|\n|\r\n?).*(?:\n|\r\n?|$)/g;
/** 2.1. https://spec.commonmark.org/0.30/#line-ending */
export const LINE_ENDING = /(?:\n|\r\n?)/;
/** 2.1. https://spec.commonmark.org/0.30/#blank-line */
export const BLANK_LINE = /^[ \t]*\r?\n?$/;
