import { parsers as babelParsers } from 'prettier/plugins/babel'
import prettier from 'prettier'

/**
 * Lexical sort function for strings, meant to be used as the sort
 * function for `Array.prototype.sort`.
 *
 * @param a - First element to compare.
 * @param b - Second element to compare.
 * @returns A number indicating which element should come first.
 */
function lexicalSort(a: string, b: string): number {
  if (a > b) {
    return 1
  }
  if (a < b) {
    return -1
  }
  return 0
}

const integerPrefixRegex = /^(\d+)/u

/**
 * Numeric sort function for strings, meant to be used as the sort
 * function for `Array.prototype.sort`.
 *
 * The number prefixing each string (if any) is sorted numerically.
 * Otherwise the string is sorted Lexically.
 *
 * @param a - First element to compare.
 * @param b - Second element to compare.
 * @returns A number indicating which element should come first.
 */
function numericSort(a: string, b: string): number {
  const aPrefixResult = a.match(integerPrefixRegex)
  const bPrefixResult = b.match(integerPrefixRegex)
  if (aPrefixResult !== null && bPrefixResult !== null) {
    const rawAPrefix = aPrefixResult[1]
    const rawBPrefix = bPrefixResult[1]
    const aPrefix = parseInt(rawAPrefix, 10)
    const bPrefix = parseInt(rawBPrefix, 10)
    const difference = aPrefix - bPrefix
    if (difference !== 0) {
      return difference
    }
  }
  return String(a) > String(b) ? 1 : -1
}

/**
 * Reverse a sort function. This is meant to wrap functions meant to be
 * used as the sort function for `Array.prototype.sort`.
 *
 * @param sortFunction - The sort function to reverse.
 * @returns A reversed sort function.
 */
function reverseSort(sortFunction: (a: string, b: string) => number): (a: string, b: string) => number {
  return (a, b) => {
    return -1 * sortFunction(a, b)
  }
}

/**
 * Make a sort function case-insensitive. This is meant to wrap
 * functions meant to be used as the sort function for
 * `Array.prototype.sort`.
 *
 * @param sortFunction - The sort function to make case-insensitive.
 * @returns A case-insensitive sort function.
 */
function caseInsensitiveSort(sortFunction: (a: string, b: string) => number): (a: string, b: string) => number {
  return (a, b) => {
    return sortFunction(a.toLowerCase(), b.toLowerCase()) || sortFunction(a, b)
  }
}

/**
 * Skip sort function, meant to be used as the sort
 * function for `Array.prototype.sort`.
 *
 * @param _a - First element to compare.
 * @param _b - Second element to compare.
 * @returns A number indicating which element should come first.
 */
function noneSort(): number {
  return 0
}

/**
 * A mapping of category sort algorithms to sort functions.
 */
const categorySortFunctions: Record<string, (a: string, b: string) => number> = {
  caseInsensitiveLexical: caseInsensitiveSort(lexicalSort),
  caseInsensitiveNumeric: caseInsensitiveSort(numericSort),
  caseInsensitiveReverseLexical: caseInsensitiveSort(reverseSort(lexicalSort)),
  caseInsensitiveReverseNumeric: caseInsensitiveSort(reverseSort(numericSort)),
  lexical: lexicalSort,
  numeric: numericSort,
  reverseLexical: reverseSort(lexicalSort),
  reverseNumeric: reverseSort(numericSort),
  none: noneSort,
}

/**
 * A list of all allowed category sort values.
 */
const allowedCategorySortValues = [null, ...Object.keys(categorySortFunctions)]

/**
 * Asserts that the given AST properties only contain 'ObjectProperty' entries.
 * The other two types are not found in JSON files.
 *
 * @param properties - The properties to check.
 * @throws Throws an error if unexpected property types are found.
 */
function assertObjectPropertyTypes(properties: any[]): void {
  const invalidProperty = properties.find(property => property.type !== 'ObjectProperty')
  if (invalidProperty !== undefined) {
    throw new Error(`Property type not supported: ${invalidProperty.type}`)
  }
}

/**
 * Asserts that the given AST object property is a string literal. This should
 * be the only type of key found in JSON files.
 *
 * @param objectPropertyKey - The key to check.
 * @throws Throws an error if the key has an unexpected type.
 */
function assertObjectPropertyKeyType(objectPropertyKey: any): void {
  if (objectPropertyKey.type !== 'StringLiteral') {
    throw new Error(`Object property key type not supported: ${objectPropertyKey.type}`)
  }
}

/**
 * Determines whether the given object property value is an array or object.
 *
 * @param value - The ObjectProperty value to check.
 * @returns True if the value is an array or object, false otherwise.
 */
function valueIsArrayOrObjectExpression(value: any): boolean {
  return ['ObjectExpression', 'ArrayExpression'].includes(value.type)
}

/**
 * Sort properties of JavaScript objects within an AST.
 *
 * @param ast - The AST to sort.
 * @param recursive - Whether to sort the object recursively or not.
 * @param sortCompareFunction - A custom sort function.
 * @returns The sorted object.
 */
function sortAst(ast: any, recursive: boolean, sortCompareFunction: (a: string, b: string) => number): any {
  if (ast.type === 'ArrayExpression' && recursive) {
    ast.elements = ast.elements.map((element: any) => {
      if (element === null || element.type === 'NullLiteral') {
        return element
      } else if (element.type === 'SpreadElement') {
        throw new Error('Unreachable; SpreadElement is not allowed in JSON')
      }
      return sortAst(element, recursive, sortCompareFunction)
    })
  } else if (ast.type === 'ObjectExpression') {
    const { properties } = ast
    assertObjectPropertyTypes(properties)
    const sortedProperties = properties.sort((propertyA: any, propertyB: any) => {
      assertObjectPropertyKeyType(propertyA.key)
      assertObjectPropertyKeyType(propertyB.key)
      return sortCompareFunction(propertyA.key.value, propertyB.key.value)
    })
    if (recursive) {
      const recursivelySortedProperties = sortedProperties.map((property: any) => {
        const { value } = property
        if (valueIsArrayOrObjectExpression(value)) {
          property.value = sortAst(value, recursive, sortCompareFunction)
        }
        return property
      })
      ast.properties = recursivelySortedProperties
    } else {
      ast.properties = sortedProperties
    }
  }
  return ast
}

/**
 * Parse JSON sort options from Prettier options.
 *
 * @param prettierOptions - Prettier options.
 * @returns JSON sort options.
 */
function parseOptions(prettierOptions: prettier.Options): { jsonRecursiveSort: boolean; jsonSortOrder?: string } {
  if (typeof prettierOptions.jsonRecursiveSort !== 'boolean') {
    throw new Error(
      `Invalid 'jsonRecursiveSort' option; expected boolean, got '${typeof prettierOptions.jsonRecursiveSort}'`
    )
  }

  const parsedJsonSortOptions: any = {
    jsonRecursiveSort: prettierOptions.jsonRecursiveSort,
  }

  if (prettierOptions.jsonSortOrder !== undefined) {
    const rawJsonSortOrder = prettierOptions.jsonSortOrder
    if (typeof rawJsonSortOrder !== 'string') {
      throw new Error(`Invalid 'jsonSortOrder' option; expected string, got '${typeof prettierOptions.jsonSortOrder}'`)
    }

    let parsedJsonSortOrder
    try {
      parsedJsonSortOrder = JSON.parse(rawJsonSortOrder)
    } catch (error) {
      throw new Error(
        `Failed to parse sort order option as JSON: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    if (Array.isArray(parsedJsonSortOrder) || typeof parsedJsonSortOrder !== 'object') {
      throw new Error('Invalid custom sort order; must be an object')
    }

    for (const categorySort of Object.values(parsedJsonSortOrder)) {
      if (
        (categorySort !== null && typeof categorySort !== 'string') ||
        !allowedCategorySortValues.includes(categorySort)
      ) {
        throw new Error(
          `Invalid custom sort entry: value must be one of '${String(allowedCategorySortValues.map(String))}', got '${String(categorySort)}'`
        )
      }
    }

    parsedJsonSortOptions.jsonSortOrder = rawJsonSortOrder
  }

  return parsedJsonSortOptions
}

/**
 * Apply default sort options.
 *
 * @param options - JSON sort options as configured.
 * @returns JSON sort options with defaults applied.
 */
function applyDefaultOptions(options: { jsonRecursiveSort: boolean; jsonSortOrder?: string }): {
  jsonRecursiveSort: boolean
  jsonSortOrder: string
} {
  const { jsonRecursiveSort, jsonSortOrder } = options
  return {
    jsonRecursiveSort,
    jsonSortOrder: jsonSortOrder || 'lexical',
  }
}

/**
 * Create a sort compare function based on the given sort order.
 *
 * @param jsonSortOrder - The sort order to use.
 * @returns A sort compare function.
 */
function createSortCompareFunction(jsonSortOrder: string): (a: string, b: string) => number {
  const evaluateSortEntry = (value: string, entry: string | null): number => {
    if (entry === null) {
      return 0
    }
    return categorySortFunctions[entry](value, value)
  }

  let sortCompareFunction: (a: string, b: string) => number
  try {
    const parsedJsonSortOrder = JSON.parse(jsonSortOrder)
    sortCompareFunction = (a: string, b: string) => {
      const aEntry = parsedJsonSortOrder[a] || null
      const bEntry = parsedJsonSortOrder[b] || null
      const aResult = evaluateSortEntry(a, aEntry)
      const bResult = evaluateSortEntry(b, bEntry)
      if (aResult !== bResult) {
        return aResult - bResult
      }
      return lexicalSort(a, b)
    }
  } catch {
    sortCompareFunction = categorySortFunctions[jsonSortOrder] || lexicalSort
  }

  return sortCompareFunction
}

/**
 * Create a parser that sorts JSON.
 *
 * @param parser - The parser to wrap.
 * @returns A parser that sorts JSON.
 */
function createParser(parser: any): any {
  return {
    ...parser,
    parse: (text: string, options: prettier.Options) => {
      const ast = parser.parse(text, options)
      const { jsonRecursiveSort, jsonSortOrder } = applyDefaultOptions(parseOptions(options))
      const sortCompareFunction = createSortCompareFunction(jsonSortOrder)
      return sortAst(ast, jsonRecursiveSort, sortCompareFunction)
    },
  }
}

export const parsers = {
  json: createParser(babelParsers.json),
}

export const options = {
  jsonRecursiveSort: {
    category: 'json-sort',
    default: false,
    description: 'Sort JSON files recursively, including any nested properties',
    since: '0.0.2',
    type: 'boolean',
  },
  jsonSortOrder: {
    category: 'json-sort',
    description: 'A JSON string specifying a custom sort order',
    since: '0.0.4',
    type: 'string',
  },
}
