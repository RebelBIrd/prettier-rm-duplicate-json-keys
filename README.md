# Prettier Plugin: Remove Duplicate JSON Keys

A Prettier plugin that removes duplicate keys from JSON files and provides flexible sorting options.

## Features

- Removes duplicate keys from JSON files
- Supports various sorting algorithms for JSON keys
- Configurable recursive sorting
- Case-insensitive sorting options
- Numeric and lexical sorting options

## Installation

```bash
npm install --save-dev prettier-rm-duplicate-json-keys
```

## Usage

Add the plugin to your Prettier configuration:

```json
{
  "plugins": ["prettier-rm-duplicate-json-keys"],
  "jsonRecursiveSort": true,
  "jsonSortOrder": "lexical"
}
```

## Configuration

### Options

- `jsonRecursiveSort` (boolean, default: false)
  - When true, sorts JSON files recursively, including any nested properties

- `jsonSortOrder` (string, default: "lexical")
  - Specifies the sorting algorithm to use
  - Available options:
    - `lexical`: Standard alphabetical sorting
    - `numeric`: Numeric prefix sorting
    - `caseInsensitiveLexical`: Case-insensitive alphabetical sorting
    - `caseInsensitiveNumeric`: Case-insensitive numeric prefix sorting
    - `reverseLexical`: Reverse alphabetical sorting
    - `reverseNumeric`: Reverse numeric prefix sorting
    - `caseInsensitiveReverseLexical`: Case-insensitive reverse alphabetical sorting
    - `caseInsensitiveReverseNumeric`: Case-insensitive reverse numeric prefix sorting
    - `none`: No sorting

## Example

Input JSON:

```json
{
  "a": 1,
  "b": 2,
  "b": 3,
  "c": {
    "z": 1,
    "y": 2,
    "z": 3
  }
}
```

Output JSON (with `jsonSortOrder: "lexical"`):

```json
{
  "a": 1,
  "b": 2,
  "c": {
    "y": 2,
    "z": 1
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## License

ISC
