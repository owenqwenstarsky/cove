export type CellInput = {
  value?: string;
  formula?: string;
};

export type CellMap = Record<string, CellInput>;

const ERRORS = ["#ERROR", "#DIV/0", "#VALUE", "#REF", "#NAME", "#CYCLE"] as const;
export type FormulaCode = (typeof ERRORS)[number];

export class FormulaError extends Error {
  constructor(public code: FormulaCode) {
    super(code);
  }
}

const CELL_RE = /^[A-Z]+[1-9][0-9]*$/;
const MAX_RANGE_CELLS = 5000;

type Token =
  | { t: "num"; n: number }
  | { t: "cell"; ref: string }
  | { t: "id"; name: string }
  | { t: "op"; op: "+" | "-" | "*" | "/" | "(" | ")" | "," | ":" }
  | { t: "eof" };

function isFormulaCode(value: string): value is FormulaCode {
  return (ERRORS as readonly string[]).includes(value);
}

export function columnIndex(label: string): number {
  let n = 0;
  for (const char of label) {
    n = n * 26 + (char.charCodeAt(0) - 64);
  }
  return n;
}

export function columnLabel(index: number): string {
  let n = index;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function splitRef(ref: string): { col: number; row: number } {
  const match = /^([A-Z]+)([0-9]+)$/.exec(ref);
  if (!match) throw new FormulaError("#REF");
  const row = Number(match[2]);
  if (!Number.isInteger(row) || row < 1) throw new FormulaError("#REF");
  return { col: columnIndex(match[1]), row };
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new FormulaError("#ERROR");
  if (Object.is(value, -0)) return "0";
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round(value * 1e10) / 1e10;
  return String(rounded);
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (char === " " || char === "\t" || char === "\n") {
      i += 1;
      continue;
    }
    if ("+-*/(),:".includes(char)) {
      tokens.push({ t: "op", op: char as "+" | "-" | "*" | "/" | "(" | ")" | "," | ":" });
      i += 1;
      continue;
    }
    if (char >= "0" && char <= "9" || char === ".") {
      let j = i + 1;
      while (j < input.length && ((input[j] >= "0" && input[j] <= "9") || input[j] === ".")) j += 1;
      const raw = input.slice(i, j);
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new FormulaError("#ERROR");
      tokens.push({ t: "num", n });
      i = j;
      continue;
    }
    if (/[A-Za-z]/.test(char)) {
      let j = i + 1;
      while (j < input.length && /[A-Za-z]/.test(input[j])) j += 1;
      const letters = input.slice(i, j).toUpperCase();
      let k = j;
      while (k < input.length && input[k] >= "0" && input[k] <= "9") k += 1;
      if (k > j) {
        const ref = letters + input.slice(j, k);
        if (!CELL_RE.test(ref)) throw new FormulaError("#REF");
        tokens.push({ t: "cell", ref });
        i = k;
      } else {
        tokens.push({ t: "id", name: letters });
        i = j;
      }
      continue;
    }
    throw new FormulaError("#ERROR");
  }
  tokens.push({ t: "eof" });
  return tokens;
}

type Agg = { kind: "blank" } | { kind: "num"; n: number } | { kind: "text" } | { kind: "err"; code: FormulaCode };

function evaluateBody(body: string, cells: CellMap, visiting: Set<string>): number {
  const tokens = tokenize(body);
  let index = 0;
  const peek = () => tokens[index] ?? { t: "eof" as const };
  const eat = () => tokens[index++] ?? { t: "eof" as const };

  function evalRef(ref: string): string {
    if (!CELL_RE.test(ref)) throw new FormulaError("#REF");
    if (visiting.has(ref)) throw new FormulaError("#CYCLE");
    const cell = cells[ref];
    if (!cell) return "";
    const formula = cell.formula?.trim();
    if (formula) {
      if (!formula.startsWith("=")) return formula;
      visiting.add(ref);
      try {
        return formatNumber(evaluateBody(formula.slice(1), cells, visiting));
      } finally {
        visiting.delete(ref);
      }
    }
    return cell.value ?? "";
  }

  function cellNumber(ref: string): number {
    const text = evalRef(ref).trim();
    if (text === "") return 0;
    if (isFormulaCode(text)) throw new FormulaError(text);
    const n = Number(text);
    if (!Number.isFinite(n)) throw new FormulaError("#VALUE");
    return n;
  }

  function cellAgg(ref: string): Agg {
    const text = evalRef(ref).trim();
    if (text === "") return { kind: "blank" };
    if (isFormulaCode(text)) return { kind: "err", code: text };
    const n = Number(text);
    if (Number.isFinite(n)) return { kind: "num", n };
    return { kind: "text" };
  }

  function rangeValues(start: string, end: string): Agg[] {
    const a = splitRef(start);
    const b = splitRef(end);
    const col1 = Math.min(a.col, b.col);
    const col2 = Math.max(a.col, b.col);
    const row1 = Math.min(a.row, b.row);
    const row2 = Math.max(a.row, b.row);
    const width = col2 - col1 + 1;
    const height = row2 - row1 + 1;
    if (width * height > MAX_RANGE_CELLS) throw new FormulaError("#REF");
    const values: Agg[] = [];
    for (let row = row1; row <= row2; row += 1) {
      for (let col = col1; col <= col2; col += 1) {
        values.push(cellAgg(`${columnLabel(col)}${row}`));
      }
    }
    return values;
  }

  function numbersFrom(values: Agg[]): number[] {
    const numbers: number[] = [];
    for (const value of values) {
      if (value.kind === "err") throw new FormulaError(value.code);
      if (value.kind === "num") numbers.push(value.n);
    }
    return numbers;
  }

  function call(name: string, values: Agg[]): number {
    const numbers = numbersFrom(values);
    if (name === "SUM") return numbers.reduce((sum, n) => sum + n, 0);
    if (name === "COUNT") return numbers.length;
    if (name === "AVERAGE") {
      if (numbers.length === 0) throw new FormulaError("#DIV/0");
      return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    }
    if (name === "MIN" || name === "MAX") {
      if (numbers.length === 0) throw new FormulaError("#VALUE");
      return name === "MIN" ? Math.min(...numbers) : Math.max(...numbers);
    }
    throw new FormulaError("#NAME");
  }

  function parseArgs(): Agg[] {
    if (peek().t === "op" && peek().t === "op" && (peek() as { op: string }).op === ")") return [];
    const values: Agg[] = [];
    for (;;) {
      values.push(...parseArg());
      if (peek().t === "op" && (peek() as { op: string }).op === ",") {
        eat();
        continue;
      }
      break;
    }
    return values;
  }

  function parseArg(): Agg[] {
    const next = tokens[index + 1];
    if (peek().t === "cell" && next?.t === "op" && next.op === ":") {
      const start = eat() as { t: "cell"; ref: string };
      eat();
      const end = eat();
      if (end.t !== "cell") throw new FormulaError("#ERROR");
      return rangeValues(start.ref, end.ref);
    }
    return [{ kind: "num", n: parseExpression() }];
  }

  function parseExpression(): number {
    let left = parseTerm();
    for (;;) {
      const token = peek();
      if (token.t === "op" && (token.op === "+" || token.op === "-")) {
        eat();
        const right = parseTerm();
        left = token.op === "+" ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseUnary();
    for (;;) {
      const token = peek();
      if (token.t === "op" && (token.op === "*" || token.op === "/")) {
        eat();
        const right = parseUnary();
        if (token.op === "/" && right === 0) throw new FormulaError("#DIV/0");
        left = token.op === "*" ? left * right : left / right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseUnary(): number {
    const token = peek();
    if (token.t === "op" && (token.op === "+" || token.op === "-")) {
      eat();
      const value = parseUnary();
      return token.op === "-" ? -value : value;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const token = eat();
    if (token.t === "num") return token.n;
    if (token.t === "cell") return cellNumber(token.ref);
    if (token.t === "id") {
      const open = eat();
      if (!(open.t === "op" && open.op === "(")) throw new FormulaError("#NAME");
      const args = parseArgs();
      const close = eat();
      if (!(close.t === "op" && close.op === ")")) throw new FormulaError("#ERROR");
      return call(token.name, args);
    }
    if (token.t === "op" && token.op === "(") {
      const value = parseExpression();
      const close = eat();
      if (!(close.t === "op" && close.op === ")")) throw new FormulaError("#ERROR");
      return value;
    }
    throw new FormulaError("#ERROR");
  }

  const value = parseExpression();
  if (peek().t !== "eof") throw new FormulaError("#ERROR");
  return value;
}

export function evaluateCell(cells: CellMap, ref: string): string {
  try {
    const key = ref.toUpperCase();
    if (!CELL_RE.test(key)) return "#REF";
    const visiting = new Set<string>();
    if (visiting.has(key)) return "#CYCLE";
    const cell = cells[key];
    if (!cell) return "";
    const formula = cell.formula?.trim();
    if (formula?.startsWith("=")) {
      visiting.add(key);
      try {
        return formatNumber(evaluateBody(formula.slice(1), cells, visiting));
      } finally {
        visiting.delete(key);
      }
    }
    if (formula) return formula;
    return cell.value ?? "";
  } catch (error) {
    if (error instanceof FormulaError) return error.code;
    return "#ERROR";
  }
}
