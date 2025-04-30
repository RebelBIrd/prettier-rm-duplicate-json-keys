import prettier from 'prettier'
import { parsers as babelParsers } from 'prettier/plugins/babel'

// 排序相关函数
function lexicalSort(a: string, b: string): number {
  if (a > b) return 1
  if (a < b) return -1
  return 0
}

const integerPrefixRegex = /^(\d+)/u

function numericSort(a: string, b: string): number {
  const aPrefixResult = a.match(integerPrefixRegex)
  const bPrefixResult = b.match(integerPrefixRegex)
  if (aPrefixResult !== null && bPrefixResult !== null) {
    const aPrefix = parseInt(aPrefixResult[1], 10)
    const bPrefix = parseInt(bPrefixResult[1], 10)
    const difference = aPrefix - bPrefix
    if (difference !== 0) return difference
  }
  return String(a) > String(b) ? 1 : -1
}

function reverseSort(sortFunction: (a: string, b: string) => number): (a: string, b: string) => number {
  return (a, b) => -1 * sortFunction(a, b)
}

function caseInsensitiveSort(sortFunction: (a: string, b: string) => number): (a: string, b: string) => number {
  return (a, b) => sortFunction(a.toLowerCase(), b.toLowerCase()) || sortFunction(a, b)
}

function noneSort(): number {
  return 0
}

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

// 递归处理对象，先去重
function deduplicateObject(obj: Record<string, any>, seen: Set<string>): Record<string, any> {
  const newObj: Record<string, any> = {}
  Object.keys(obj).forEach(key => {
    if (!seen.has(key)) {
      seen.add(key)
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        newObj[key] = deduplicateObject(obj[key], seen)
      } else {
        newObj[key] = obj[key]
      }
    }
  })
  return newObj
}

// 递归排序对象
function sortObject(obj: any, sortFunction: (a: string, b: string) => number): any {
  if (Array.isArray(obj)) {
    return obj.map(item => (typeof item === 'object' && item !== null ? sortObject(item, sortFunction) : item))
  }

  const sortedKeys = Object.keys(obj).sort(sortFunction)
  const result: Record<string, any> = {}
  sortedKeys.forEach(key => {
    result[key] = typeof obj[key] === 'object' && obj[key] !== null ? sortObject(obj[key], sortFunction) : obj[key]
  })
  return result
}

// 创建排序函数
function createSortFunction(sortOrder: string | undefined): (a: string, b: string) => number {
  if (!sortOrder) return lexicalSort
  return categorySortFunctions[sortOrder] || lexicalSort
}

// 去重和排序主函数
function processJson(text: string, options: prettier.Options): string {
  try {
    const json = JSON.parse(text)
    const seen = new Set<string>()

    // 先去重
    const deduplicatedJson = deduplicateObject(json, seen)

    // 再排序
    const sortFunction = createSortFunction(options.jsonSortOrder as string)
    const sortedJson = sortObject(deduplicatedJson, sortFunction)

    return JSON.stringify(sortedJson, null, 2)
  } catch (error) {
    console.error('Error processing JSON:', error)
    return text
  }
}

export default {
  parsers: {
    json: {
      ...babelParsers.json,
      parse: (text: string) => text,
      astFormat: 'json',
      locStart: (node: any) => node.start,
      locEnd: (node: any) => node.end,
    },
  },
  printers: {
    json: {
      print: (path: any, options: prettier.Options) => {
        const text = path.getValue()
        return processJson(text, options)
      },
    },
  },
  options: {
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
  },
}
