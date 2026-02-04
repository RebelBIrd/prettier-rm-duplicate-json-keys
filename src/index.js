const prettier = require('prettier')
const babel_1 = require('prettier/plugins/babel')

// 排序相关函数
function lexicalSort(a, b) {
  if (a > b) return 1
  if (a < b) return -1
  return 0
}

const integerPrefixRegex = /^(\d+)/u

function numericSort(a, b) {
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

function reverseSort(sortFunction) {
  return (a, b) => -1 * sortFunction(a, b)
}

function caseInsensitiveSort(sortFunction) {
  return (a, b) => sortFunction(a.toLowerCase(), b.toLowerCase()) || sortFunction(a, b)
}

function noneSort(_a, _b) {
  return 0
}

const categorySortFunctions = {
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

// 检查文件路径是否匹配指定的模式
function matchesFilePattern(filepath, pattern) {
  if (!pattern || !filepath) return true

  // 支持多个模式，用逗号分隔
  const patterns = pattern.split(',').map(p => p.trim())

  for (const p of patterns) {
    // 将 glob 模式转换为正则表达式
    const regexPattern = p
      .replace(/\./g, '\\.') // 转义点
      .replace(/\*\*/g, '{{DOUBLE_STAR}}') // 临时替换 **
      .replace(/\*/g, '[^/]*') // * 匹配非斜杠字符
      .replace(/{{DOUBLE_STAR}}/g, '.*') // ** 匹配任意字符
      .replace(/\?/g, '.') // ? 匹配单个字符

    const regex = new RegExp(regexPattern)
    if (regex.test(filepath)) {
      return true
    }
  }
  return false
}

// 去重和排序主函数
function processJson(text, options) {
  try {
    // 检查文件是否匹配指定的模式
    const filepath = options.filepath || ''
    const filePattern = options.jsonFilePattern || ''

    if (filePattern && !matchesFilePattern(filepath, filePattern)) {
      // 不匹配模式，直接返回原文本（使用 prettier 默认格式化）
      return JSON.stringify(JSON.parse(text), null, 2)
    }

    const json = JSON.parse(text)

    // 递归处理对象，去重（只处理对象，不处理数组）
    function deduplicateObject(obj, parentSeen = null) {
      // 如果是数组，递归处理数组中的每个元素
      if (Array.isArray(obj)) {
        return obj.map(item => {
          if (typeof item === 'object' && item !== null) {
            return deduplicateObject(item, null)
          }
          return item
        })
      }

      // 如果不是对象，直接返回
      if (typeof obj !== 'object' || obj === null) {
        return obj
      }

      // 对于对象，进行去重处理
      const seen = parentSeen || new Set()
      const newObj = {}
      Object.keys(obj).forEach(key => {
        if (!seen.has(key)) {
          seen.add(key)
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            // 对于嵌套对象/数组，使用新的 seen set
            newObj[key] = deduplicateObject(obj[key], null)
          } else {
            newObj[key] = obj[key]
          }
        }
      })
      return newObj
    }

    // 递归排序对象
    function sortObject(obj, sortFunction) {
      // 如果是数组，递归处理数组中的每个元素，但不对数组本身进行排序
      if (Array.isArray(obj)) {
        return obj.map(item => (typeof item === 'object' && item !== null ? sortObject(item, sortFunction) : item))
      }

      // 如果不是对象，直接返回
      if (typeof obj !== 'object' || obj === null) {
        return obj
      }

      const sortedKeys = Object.keys(obj).sort(sortFunction)
      const result = {}
      sortedKeys.forEach(key => {
        result[key] = typeof obj[key] === 'object' && obj[key] !== null ? sortObject(obj[key], sortFunction) : obj[key]
      })
      return result
    }

    // 创建排序函数
    function createSortFunction(sortOrder) {
      if (!sortOrder) return lexicalSort
      return categorySortFunctions[sortOrder] || lexicalSort
    }

    // 先去重
    const deduplicatedJson = deduplicateObject(json, null)

    // 再排序
    const sortFunction = createSortFunction(options.jsonSortOrder)
    const sortedJson = sortObject(deduplicatedJson, sortFunction)

    return JSON.stringify(sortedJson, null, 2)
  } catch (error) {
    console.error('Error processing JSON:', error)
    return text
  }
}

module.exports = {
  parsers: {
    json: {
      ...babel_1.parsers.json,
      parse: text => text,
      astFormat: 'json',
      locStart: node => node.start,
      locEnd: node => node.end,
    },
  },
  printers: {
    json: {
      print: (path, options) => {
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
    jsonFilePattern: {
      category: 'json-sort',
      description:
        'A glob pattern to specify which files to process (e.g., "locales/*.json", "src/**/*.json"). Multiple patterns can be separated by commas.',
      since: '1.2.0',
      type: 'string',
      default: '',
    },
  },
}
