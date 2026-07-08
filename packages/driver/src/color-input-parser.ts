export interface ParseColorInputExpressionOptions {
  currentValue: number;
  range: [number, number];
  allowExpressions?: boolean;
}

interface NumberToken {
  type: 'number';
  value: number;
  isPercent: boolean;
}

interface OperatorToken {
  type: 'operator';
  value: '+' | '-' | '*' | '/';
}

interface ParenToken {
  type: 'paren';
  value: '(' | ')';
}

type ExpressionToken = NumberToken | OperatorToken | ParenToken;

function tokenizeExpression(
  input: string,
): { tokens: ExpressionToken[]; hasPercent: boolean } | null {
  const tokens: ExpressionToken[] = [];
  let index = 0;
  let hasPercent = false;

  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({
        type: 'paren',
        value: char,
      });
      index += 1;
      continue;
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({
        type: 'operator',
        value: char,
      });
      index += 1;
      continue;
    }

    if (char === '.' || /\d/.test(char)) {
      let cursor = index;
      let seenDot = false;
      let seenDigit = false;

      while (cursor < input.length) {
        const tokenChar = input[cursor];
        if (tokenChar === '.') {
          if (seenDot) break;
          seenDot = true;
          cursor += 1;
          continue;
        }
        if (!/\d/.test(tokenChar)) break;
        seenDigit = true;
        cursor += 1;
      }

      if (!seenDigit) {
        return null;
      }

      const numericText = input.slice(index, cursor);
      const numericValue = Number.parseFloat(numericText);
      if (!Number.isFinite(numericValue)) {
        return null;
      }

      let isPercent = false;
      const suffix = input.slice(cursor, cursor + 3).toLowerCase();
      if (suffix === 'deg') {
        cursor += 3;
      } else if (input[cursor] === '%') {
        isPercent = true;
        hasPercent = true;
        cursor += 1;
      }

      tokens.push({
        type: 'number',
        value: numericValue,
        isPercent,
      });

      index = cursor;
      continue;
    }

    return null;
  }

  return {
    tokens,
    hasPercent,
  };
}

function parseExpressionTokens(
  tokens: ExpressionToken[],
  range: [number, number],
): number | null {
  let index = 0;
  const span = range[1] - range[0];

  const parseExpression = (): number | null => {
    const start = parseTerm();
    if (start === null) {
      return null;
    }

    let value = start;
    while (
      index < tokens.length &&
      tokens[index].type === 'operator' &&
      (tokens[index] as OperatorToken).value !== '*' &&
      (tokens[index] as OperatorToken).value !== '/'
    ) {
      const operator = (tokens[index] as OperatorToken).value;
      index += 1;
      const right = parseTerm();
      if (right === null) {
        return null;
      }
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };

  const parseTerm = (): number | null => {
    const start = parseFactor();
    if (start === null) {
      return null;
    }

    let value = start;
    while (
      index < tokens.length &&
      tokens[index].type === 'operator' &&
      ((tokens[index] as OperatorToken).value === '*' ||
        (tokens[index] as OperatorToken).value === '/')
    ) {
      const operator = (tokens[index] as OperatorToken).value;
      index += 1;
      const right = parseFactor();
      if (right === null) {
        return null;
      }
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };

  const parseFactor = (): number | null => {
    if (
      index < tokens.length &&
      tokens[index].type === 'operator' &&
      ((tokens[index] as OperatorToken).value === '+' ||
        (tokens[index] as OperatorToken).value === '-')
    ) {
      const operator = (tokens[index] as OperatorToken).value;
      index += 1;
      const next = parseFactor();
      if (next === null) {
        return null;
      }
      return operator === '-' ? -next : next;
    }

    if (index >= tokens.length) {
      return null;
    }

    const token = tokens[index];
    if (token.type === 'number') {
      index += 1;
      if (token.isPercent) {
        return (token.value / 100) * span;
      }
      return token.value;
    }

    if (token.type === 'paren' && token.value === '(') {
      index += 1;
      const nested = parseExpression();
      if (nested === null) {
        return null;
      }
      if (
        index >= tokens.length ||
        tokens[index].type !== 'paren' ||
        (tokens[index] as ParenToken).value !== ')'
      ) {
        return null;
      }
      index += 1;
      return nested;
    }

    return null;
  };

  const value = parseExpression();
  if (value === null || index !== tokens.length) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

function parseSimpleNumber(
  input: string,
  range: [number, number],
): number | null {
  const match = input.trim().match(/^([+-]?(?:\d+|\d*\.\d+))(deg|%)?$/i);
  if (!match) {
    return null;
  }

  const number = Number.parseFloat(match[1]);
  if (!Number.isFinite(number)) {
    return null;
  }

  const unit = match[2]?.toLowerCase();
  if (unit === '%') {
    return range[0] + ((range[1] - range[0]) * number) / 100;
  }

  return number;
}

export function parseColorInputExpression(
  input: string,
  options: ParseColorInputExpressionOptions,
): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (!options.allowExpressions) {
    return parseSimpleNumber(trimmed, options.range);
  }

  const isRelative = /^[+\-*/]/.test(trimmed);
  const expression = isRelative ? `${options.currentValue}${trimmed}` : trimmed;

  const tokenized = tokenizeExpression(expression);
  if (!tokenized) {
    return parseSimpleNumber(expression, options.range);
  }

  const evaluated = parseExpressionTokens(tokenized.tokens, options.range);
  if (evaluated === null) {
    return parseSimpleNumber(expression, options.range);
  }

  if (!isRelative && tokenized.hasPercent) {
    return evaluated + options.range[0];
  }
  return evaluated;
}
