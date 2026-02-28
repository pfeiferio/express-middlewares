const valid = /^[a-z0-9_ \-:]+$/i
const valid2 = /^[a-z0-9_ \-:,]+$/i

export const idRegexCheck = (val: string, commaAllowed: boolean = false) =>
  commaAllowed ? valid2.test(val) : valid.test(val)
