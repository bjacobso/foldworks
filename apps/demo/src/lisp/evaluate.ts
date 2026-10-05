// A tracing interpreter. Evaluating the program records the last value (or
// error) of every expression, so each outline item can show what it did,
// including items inside functions, which show their most recent call.

import { itemOf } from "./codec";
import { code, type Expr } from "./syntax";

export type Keyword = Readonly<{ _tag: "Keyword"; name: string }>;
export type Sym = Readonly<{ _tag: "Sym"; name: string }>;
export type ListValue = Readonly<{ _tag: "List"; items: ReadonlyArray<Value> }>;
export type VectorValue = Readonly<{ _tag: "Vector"; items: ReadonlyArray<Value> }>;
export type MapValue = Readonly<{ _tag: "Map"; entries: ReadonlyArray<readonly [Value, Value]> }>;
export type Fn = Readonly<{
  _tag: "Fn";
  name: string;
  params: string;
  /** `at` is the calling expression, for error messages. */
  call: (args: ReadonlyArray<Value>, at: string) => Value;
}>;

/** A unit of work in a workflow, declared with `defstep`. */
export type Step = Readonly<{
  _tag: "Step";
  name: string;
  system: string;
  reads: ReadonlyArray<string>;
  writes: ReadonlyArray<string>;
  /** The item that declares the step. */
  definedAt: string;
}>;

/** Workflow structure. `at` is the expression that produced each node. */
export type FlowNode =
  | Readonly<{ kind: "Step"; step: Step; at: string }>
  | Readonly<{ kind: "Sequence" | "Parallel"; children: ReadonlyArray<FlowNode>; at: string }>
  | Readonly<{ kind: "Branch"; label: string; child: FlowNode; at: string }>;

export type Flow = Readonly<{ _tag: "Flow"; name: string | null; node: FlowNode }>;

export type Value =
  | null
  | boolean
  | number
  | string
  | Keyword
  | Sym
  | ListValue
  | VectorValue
  | MapValue
  | Fn
  | Step
  | Flow;

export class EvalError extends Error {
  constructor(
    message: string,
    readonly at: string,
  ) {
    super(message);
  }
}

export type Observation = Readonly<{ value: Value; count: number }>;

/** One evaluated expression of a traced form, in the order evaluation finished it. */
export type TraceStep = Readonly<{ exprId: string; value: Value; depth: number }>;

export type Evaluation = Readonly<{
  /** The last value of every expression, by expression id. */
  values: ReadonlyMap<string, Observation>;
  /** Runtime errors, by the item where they were raised. */
  errors: ReadonlyMap<string, string>;
  /** The expression that raised each item's error. */
  errorSites: ReadonlyMap<string, string>;
  globals: ReadonlyMap<string, Value>;
  /** Named workflows, in definition order. */
  workflows: ReadonlyArray<Flow>;
  /** Every expression the traced form evaluated, including inside the functions it called. */
  trace: ReadonlyArray<TraceStep>;
}>;

class Env {
  private readonly vars = new Map<string, Value>();
  constructor(readonly parent: Env | null) {}
  lookup(name: string): Value | undefined {
    return this.vars.has(name) ? this.vars.get(name) : this.parent?.lookup(name);
  }
  has(name: string): boolean {
    return this.vars.has(name) || (this.parent?.has(name) ?? false);
  }
  define(name: string, value: Value): void {
    this.vars.set(name, value);
  }
  entries(): ReadonlyMap<string, Value> {
    return this.vars;
  }
}

const keyword = (name: string): Keyword => ({ _tag: "Keyword", name });
const vector = (items: ReadonlyArray<Value>): VectorValue => ({ _tag: "Vector", items });

const isObject = (value: Value): value is Exclude<Value, null | boolean | number | string> =>
  value !== null && typeof value === "object";

export const isFlow = (value: Value): value is Flow => isObject(value) && value._tag === "Flow";
export const isStep = (value: Value): value is Step => isObject(value) && value._tag === "Step";

const truthy = (value: Value): boolean => value !== null && value !== false;

export const equal = (a: Value, b: Value): boolean => {
  if (a === b) return true;
  if (!isObject(a) || !isObject(b) || a._tag !== b._tag) return false;
  switch (a._tag) {
    case "Keyword":
    case "Sym":
      return a.name === (b as Keyword | Sym).name;
    case "List":
    case "Vector": {
      const other = (b as ListValue | VectorValue).items;
      return a.items.length === other.length && a.items.every((x, i) => equal(x, other[i]!));
    }
    case "Map": {
      const other = b as MapValue;
      return (
        a.entries.length === other.entries.length &&
        a.entries.every(([key, value]) => {
          const match = other.entries.find(([otherKey]) => equal(key, otherKey));
          return match !== undefined && equal(value, match[1]);
        })
      );
    }
    default:
      return false;
  }
};

const formatNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));

const countSteps = (node: FlowNode): number =>
  node.kind === "Step"
    ? 1
    : node.kind === "Branch"
      ? countSteps(node.child)
      : node.children.reduce((sum, child) => sum + countSteps(child), 0);

/** A readable rendering of a value, shortened past `limit` characters. */
export const show = (value: Value, limit = 64): string => {
  const render = (current: Value): string => {
    if (current === null) return "nil";
    if (typeof current === "boolean") return String(current);
    if (typeof current === "number") return formatNumber(current);
    if (typeof current === "string") return JSON.stringify(current);
    switch (current._tag) {
      case "Keyword":
        return `:${current.name}`;
      case "Sym":
        return current.name;
      case "List":
        return `(${current.items.map(render).join(" ")})`;
      case "Vector":
        return `[${current.items.map(render).join(" ")}]`;
      case "Map":
        return `{${current.entries.map(([key, entry]) => `${render(key)} ${render(entry)}`).join(", ")}}`;
      case "Fn":
        return `ƒ ${current.name}${current.params}`;
      case "Step":
        return `step · ${current.system}`;
      case "Flow": {
        const steps = countSteps(current.node);
        return `${current.name === null ? "flow" : `workflow ${current.name}`} · ${steps} ${steps === 1 ? "step" : "steps"}`;
      }
    }
  };
  const text = render(value);
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
};

export const SPECIAL_FORMS: ReadonlySet<string> = new Set([
  "quote",
  "def",
  "defn",
  "fn",
  "let",
  "if",
  "when",
  "cond",
  "do",
  "section",
  "and",
  "or",
  "->",
  "defstep",
  "workflow",
  "sequence",
  "parallel",
  "branch",
]);

/** Forms whose second element names what they define. */
export const DEFINING_FORMS: ReadonlySet<string> = new Set(["def", "defn", "defstep", "workflow"]);

const expectNumber = (value: Value, at: string, name: string): number => {
  if (typeof value !== "number")
    throw new EvalError(`${name} expects numbers, got ${show(value)}`, at);
  return value;
};

const seq = (value: Value, at: string): ReadonlyArray<Value> => {
  if (value === null) return [];
  if (typeof value === "string") return [...value];
  if (isObject(value)) {
    if (value._tag === "List" || value._tag === "Vector") return value.items;
    if (value._tag === "Map") return value.entries.map(([key, entry]) => vector([key, entry]));
  }
  throw new EvalError(`${show(value)} is not a collection`, at);
};

const lookupKey = (map: Value, key: Value): Value => {
  if (isObject(map) && map._tag === "Map") {
    return map.entries.find(([candidate]) => equal(candidate, key))?.[1] ?? null;
  }
  if (isObject(map) && map._tag === "Vector" && typeof key === "number") {
    return map.items[key] ?? null;
  }
  return null;
};

const assoc = (map: MapValue, key: Value, value: Value): MapValue => ({
  _tag: "Map",
  entries: [...map.entries.filter(([candidate]) => !equal(candidate, key)), [key, value]],
});

const keywordNames = (value: Value): ReadonlyArray<string> =>
  value === null
    ? []
    : isObject(value) && value._tag === "Keyword"
      ? [value.name]
      : isObject(value) && (value._tag === "Vector" || value._tag === "List")
        ? value.items.flatMap(keywordNames)
        : [];

const flowNode = (value: Value, at: string): FlowNode => {
  if (isFlow(value)) return value.node;
  if (isStep(value)) return { kind: "Step", step: value, at };
  throw new EvalError(`${show(value)} is not a step or a flow`, at);
};

/**
 * For every step occurrence (by `at`), the steps that are certain to have
 * finished before it starts, on every path through the flow.
 */
export const happensBefore = (node: FlowNode): ReadonlyMap<string, ReadonlySet<string>> => {
  const before = new Map<string, ReadonlySet<string>>();
  const visit = (current: FlowNode, preceding: ReadonlySet<string>): ReadonlySet<string> => {
    switch (current.kind) {
      case "Step":
        before.set(current.at, preceding);
        return new Set([...preceding, current.step.name]);
      case "Sequence":
        return current.children.reduce((done, child) => visit(child, done), preceding);
      case "Parallel":
        return current.children.reduce<ReadonlySet<string>>(
          (done, child) => new Set([...done, ...visit(child, preceding)]),
          preceding,
        );
      case "Branch":
        visit(current.child, preceding);
        return preceding;
    }
  };
  visit(node, new Set());
  return before;
};

export const occurrences = (node: FlowNode): ReadonlyArray<Extract<FlowNode, { kind: "Step" }>> =>
  node.kind === "Step"
    ? [node]
    : node.kind === "Branch"
      ? occurrences(node.child)
      : node.children.flatMap(occurrences);

const BUDGET = 200_000;

const builtins = (): ReadonlyMap<string, (args: ReadonlyArray<Value>, at: string) => Value> => {
  const numeric =
    (name: string, f: (a: number, b: number) => number, unit?: number) =>
    (args: ReadonlyArray<Value>, at: string): Value => {
      const numbers = args.map((arg) => expectNumber(arg, at, name));
      if (numbers.length === 0) {
        if (unit === undefined) throw new EvalError(`${name} needs arguments`, at);
        return unit;
      }
      if (numbers.length === 1 && unit !== undefined && name !== "+" && name !== "*") {
        return f(unit, numbers[0]!);
      }
      return numbers.reduce(f);
    };
  const compare =
    (f: (a: number, b: number) => boolean, name: string) =>
    (args: ReadonlyArray<Value>, at: string): Value => {
      const numbers = args.map((arg) => expectNumber(arg, at, name));
      return numbers.every((value, index) => index === 0 || f(numbers[index - 1]!, value));
    };
  const call = (fn: Value, args: ReadonlyArray<Value>, at: string): Value => {
    if (isObject(fn) && fn._tag === "Fn") return fn.call(args, at);
    if (isObject(fn) && fn._tag === "Keyword") return lookupKey(args[0] ?? null, fn);
    throw new EvalError(`${show(fn)} is not a function`, at);
  };
  return new Map<string, (args: ReadonlyArray<Value>, at: string) => Value>([
    ["+", numeric("+", (a, b) => a + b, 0)],
    ["-", numeric("-", (a, b) => a - b, 0)],
    ["*", numeric("*", (a, b) => a * b, 1)],
    ["/", numeric("/", (a, b) => a / b, 1)],
    ["mod", numeric("mod", (a, b) => ((a % b) + b) % b)],
    ["max", numeric("max", Math.max)],
    ["min", numeric("min", Math.min)],
    ["<", compare((a, b) => a < b, "<")],
    [">", compare((a, b) => a > b, ">")],
    ["<=", compare((a, b) => a <= b, "<=")],
    [">=", compare((a, b) => a >= b, ">=")],
    ["=", (args) => args.every((arg) => equal(arg, args[0]!))],
    ["not=", (args) => !args.every((arg) => equal(arg, args[0]!))],
    ["not", (args) => !truthy(args[0] ?? null)],
    ["inc", (args, at) => expectNumber(args[0] ?? null, at, "inc") + 1],
    ["dec", (args, at) => expectNumber(args[0] ?? null, at, "dec") - 1],
    [
      "round",
      (args, at) => {
        const places = args[1] === undefined ? 0 : expectNumber(args[1], at, "round");
        const factor = 10 ** places;
        return Math.round(expectNumber(args[0] ?? null, at, "round") * factor) / factor;
      },
    ],
    [
      "str",
      (args) =>
        args
          .map((arg) => (typeof arg === "string" ? arg : arg === null ? "" : show(arg, Infinity)))
          .join(""),
    ],
    ["list", (args) => ({ _tag: "List", items: args })],
    ["vector", (args) => vector(args)],
    [
      "hash-map",
      (args) => {
        let map: MapValue = { _tag: "Map", entries: [] };
        for (let index = 0; index + 1 < args.length; index += 2) {
          map = assoc(map, args[index]!, args[index + 1]!);
        }
        return map;
      },
    ],
    ["count", (args, at) => seq(args[0] ?? null, at).length],
    ["empty?", (args, at) => seq(args[0] ?? null, at).length === 0],
    ["first", (args, at) => seq(args[0] ?? null, at)[0] ?? null],
    ["rest", (args, at) => vector(seq(args[0] ?? null, at).slice(1))],
    [
      "nth",
      (args, at) => seq(args[0] ?? null, at)[expectNumber(args[1] ?? null, at, "nth")] ?? null,
    ],
    ["conj", (args, at) => vector([...seq(args[0] ?? null, at), ...args.slice(1)])],
    ["get", (args) => lookupKey(args[0] ?? null, args[1] ?? null) ?? args[2] ?? null],
    [
      "assoc",
      (args, at) => {
        const map = args[0] ?? null;
        if (map !== null && !(isObject(map) && map._tag === "Map")) {
          throw new EvalError(`assoc expects a map, got ${show(map)}`, at);
        }
        let result: MapValue = map ?? { _tag: "Map", entries: [] };
        for (let index = 1; index + 1 < args.length; index += 2) {
          result = assoc(result, args[index]!, args[index + 1]!);
        }
        return result;
      },
    ],
    [
      "keys",
      (args, at) => {
        const map = args[0] ?? null;
        if (!(isObject(map) && map._tag === "Map")) throw new EvalError("keys expects a map", at);
        return vector(map.entries.map(([key]) => key));
      },
    ],
    [
      "vals",
      (args, at) => {
        const map = args[0] ?? null;
        if (!(isObject(map) && map._tag === "Map")) throw new EvalError("vals expects a map", at);
        return vector(map.entries.map(([, entry]) => entry));
      },
    ],
    [
      "map",
      (args, at) => vector(seq(args[1] ?? null, at).map((x) => call(args[0] ?? null, [x], at))),
    ],
    [
      "filter",
      (args, at) =>
        vector(seq(args[1] ?? null, at).filter((x) => truthy(call(args[0] ?? null, [x], at)))),
    ],
    [
      "reduce",
      (args, at) => {
        const items = seq(args.at(-1) ?? null, at);
        const [initial, ...rest] = args.length >= 3 ? [args[1]!, ...items] : items;
        return rest.reduce<Value>(
          (total, x) => call(args[0] ?? null, [total, x], at),
          initial ?? null,
        );
      },
    ],
    [
      "range",
      (args, at) => {
        const [from, to] =
          args.length === 1
            ? [0, expectNumber(args[0]!, at, "range")]
            : [
                expectNumber(args[0] ?? null, at, "range"),
                expectNumber(args[1] ?? null, at, "range"),
              ];
        if (to - from > 10_000) throw new EvalError("range is too large", at);
        return vector(Array.from({ length: Math.max(0, to - from) }, (_, index) => from + index));
      },
    ],
    ["apply", (args, at) => call(args[0] ?? null, seq(args[1] ?? null, at), at)],
    ["identity", (args) => args[0] ?? null],
    [
      "before?",
      (args, at) => {
        const [flow, first, then] = args;
        if (flow === undefined || !isFlow(flow))
          throw new EvalError("before? expects a flow first", at);
        const name = (value: Value | undefined): string => {
          if (value !== undefined && isStep(value)) return value.name;
          if (value !== undefined && isFlow(value) && value.node.kind === "Step") {
            return value.node.step.name;
          }
          throw new EvalError("before? compares two steps", at);
        };
        const firstName = name(first);
        const thenName = name(then);
        const before = happensBefore(flow.node);
        const targets = occurrences(flow.node).filter((node) => node.step.name === thenName);
        return (
          targets.length > 0 &&
          targets.every((node) => before.get(node.at)?.has(firstName) === true)
        );
      },
    ],
  ]);
};

export const BUILTINS: ReadonlySet<string> = new Set([
  ...builtins().keys(),
  "true",
  "false",
  "nil",
]);

/** Evaluates every top-level form in order, continuing past errors. */
export const evaluate = (
  forms: ReadonlyArray<Expr>,
  options: Readonly<{ trace?: string }> = {},
): Evaluation => {
  const trace: TraceStep[] = [];
  let depth = 0;
  let tracedFrom = -1;
  const values = new Map<string, Observation>();
  const errors = new Map<string, string>();
  const errorSites = new Map<string, string>();
  const workflows: Flow[] = [];
  const global = new Env(null);
  const natives = builtins();
  let budget = BUDGET;

  for (const [name, f] of natives) {
    global.define(name, { _tag: "Fn", name, params: "", call: f });
  }

  const record = (expr: Expr, value: Value): Value => {
    values.set(expr.id, { value, count: (values.get(expr.id)?.count ?? 0) + 1 });
    return value;
  };

  const symbolName = (expr: Expr | undefined, at: string, what: string): string => {
    if (expr?._tag !== "Symbol") throw new EvalError(`${what} needs a name`, at);
    return expr.name;
  };

  const params = (expr: Expr | undefined, at: string): ReadonlyArray<string> => {
    if (expr?._tag !== "Vector") throw new EvalError("Parameters go in a vector, like [x y]", at);
    return expr.items.map((param) => symbolName(param, at, "Each parameter"));
  };

  const lambda = (
    name: string,
    names: ReadonlyArray<string>,
    body: ReadonlyArray<Expr>,
    env: Env,
  ): Fn => {
    const restAt = names.indexOf("&");
    const fixed = restAt < 0 ? names : names.slice(0, restAt);
    const rest = restAt < 0 ? undefined : names[restAt + 1];
    const fn: Fn = {
      _tag: "Fn",
      name,
      params: `[${names.join(" ")}]`,
      call: (args, callAt) => {
        if (rest === undefined ? args.length !== fixed.length : args.length < fixed.length) {
          throw new EvalError(
            `${name} takes ${fixed.length} ${fixed.length === 1 ? "argument" : "arguments"}, got ${args.length}`,
            callAt,
          );
        }
        const scope = new Env(env);
        fixed.forEach((param, index) => scope.define(param, args[index]!));
        if (rest !== undefined) scope.define(rest, vector(args.slice(fixed.length)));
        let result: Value = null;
        for (const expr of body) result = run(expr, scope);
        return result;
      },
    };
    return fn;
  };

  const run = (expr: Expr, env: Env): Value => {
    budget -= 1;
    if (budget < 0) throw new EvalError("Stopped: evaluation took too long", expr.id);
    const starts = tracedFrom < 0 && expr.id === options.trace;
    if (starts) tracedFrom = depth;
    depth += 1;
    try {
      const value = evalExpr(expr, env);
      if (tracedFrom >= 0) trace.push({ exprId: expr.id, value, depth: depth - 1 - tracedFrom });
      return record(expr, value);
    } finally {
      depth -= 1;
      if (starts) tracedFrom = -1;
    }
  };

  /** Runs a top-level form, recording an error instead of throwing. */
  const attempt = (form: Expr, env: Env): Value | undefined => {
    try {
      return run(form, env);
    } catch (error) {
      if (error instanceof EvalError) {
        errors.set(itemOf(error.at), error.message);
        errorSites.set(itemOf(error.at), error.at);
      } else if (error instanceof RangeError) {
        errors.set(itemOf(form.id), "Stopped: recursion went too deep");
      } else {
        errors.set(itemOf(form.id), error instanceof Error ? error.message : String(error));
      }
      return undefined;
    }
  };

  const evalExpr = (expr: Expr, env: Env): Value => {
    switch (expr._tag) {
      case "Number":
      case "String":
        return expr.value;
      case "Keyword":
        return keyword(expr.name);
      case "Comment":
        return null;
      case "Symbol": {
        if (expr.name === "true") return true;
        if (expr.name === "false") return false;
        if (expr.name === "nil") return null;
        if (!env.has(expr.name)) {
          throw new EvalError(
            SPECIAL_FORMS.has(expr.name)
              ? `${expr.name} is a special form; use it at the head of a list`
              : `${expr.name} is not defined`,
            expr.id,
          );
        }
        return env.lookup(expr.name) ?? null;
      }
      case "Vector":
        return vector(code(expr.items).map((item) => run(item, env)));
      case "Map": {
        const items = code(expr.items);
        if (items.length % 2 !== 0) throw new EvalError("A map needs key-value pairs", expr.id);
        let map: MapValue = { _tag: "Map", entries: [] };
        for (let index = 0; index < items.length; index += 2) {
          map = assoc(map, run(items[index]!, env), run(items[index + 1]!, env));
        }
        return map;
      }
      case "List":
        return evalList(expr, code(expr.items), env);
    }
  };

  const evalBody = (body: ReadonlyArray<Expr>, env: Env): Value =>
    body.reduce<Value>((_, expr) => run(expr, env), null);

  const evalList = (expr: Expr, items: ReadonlyArray<Expr>, env: Env): Value => {
    const [head, ...args] = items;
    if (head === undefined) return { _tag: "List", items: [] };
    const at = expr.id;
    if (head._tag === "Symbol" && SPECIAL_FORMS.has(head.name) && !env.has(head.name)) {
      switch (head.name) {
        case "quote":
          return quote(args[0]);
        case "def": {
          const name = symbolName(args[0], at, "def");
          const value = args[1] === undefined ? null : run(args[1], env);
          global.define(name, value);
          return value;
        }
        case "defn": {
          const name = symbolName(args[0], at, "defn");
          const rest = args.slice(1).filter((arg) => arg._tag !== "String");
          const fn = lambda(name, params(rest[0], at), rest.slice(1), env);
          global.define(name, fn);
          return fn;
        }
        case "fn": {
          const named = args[0]?._tag === "Symbol" ? args[0].name : null;
          const rest = named === null ? args : args.slice(1);
          return lambda(named ?? "fn", params(rest[0], at), rest.slice(1), env);
        }
        case "let": {
          const bindings = args[0];
          if (bindings?._tag !== "Vector" || code(bindings.items).length % 2 !== 0) {
            throw new EvalError("let needs a vector of name-value pairs", at);
          }
          const scope = new Env(env);
          const pairs = code(bindings.items);
          for (let index = 0; index < pairs.length; index += 2) {
            scope.define(
              symbolName(pairs[index], at, "Each binding"),
              run(pairs[index + 1]!, scope),
            );
          }
          return evalBody(args.slice(1), scope);
        }
        case "if": {
          const [test, then, otherwise] = args;
          if (test === undefined) throw new EvalError("if needs a test", at);
          if (truthy(run(test, env))) return then === undefined ? null : run(then, env);
          return otherwise === undefined ? null : run(otherwise, env);
        }
        case "when": {
          const [test, ...body] = args;
          if (test === undefined) throw new EvalError("when needs a test", at);
          return truthy(run(test, env)) ? evalBody(body, env) : null;
        }
        case "cond": {
          for (let index = 0; index + 1 < args.length; index += 2) {
            const test = args[index]!;
            const isElse = test._tag === "Keyword" && test.name === "else";
            if (isElse || truthy(run(test, env))) return run(args[index + 1]!, env);
          }
          return null;
        }
        case "do":
          return evalBody(args, env);
        case "section": {
          // A titled group of top-level forms. Like the top level, an error in
          // one form does not stop the forms after it.
          const [title, ...body] = args;
          let result: Value = null;
          for (const form of title?._tag === "String" ? body : args) {
            result = attempt(form, env) ?? result;
          }
          return result;
        }
        case "and": {
          let result: Value = true;
          for (const arg of args) {
            result = run(arg, env);
            if (!truthy(result)) return result;
          }
          return result;
        }
        case "or": {
          let result: Value = null;
          for (const arg of args) {
            result = run(arg, env);
            if (truthy(result)) return result;
          }
          return result;
        }
        case "->": {
          const [initial, ...steps] = args;
          if (initial === undefined) throw new EvalError("-> needs a value", at);
          let result = run(initial, env);
          for (const step of steps) {
            const [fnExpr, ...extra] =
              step._tag === "List" ? code(step.items) : ([step] as ReadonlyArray<Expr>);
            const fn = run(fnExpr!, env);
            const rest = extra.map((arg) => run(arg, env));
            result = record(step, applyFn(fn, [result, ...rest], step.id));
          }
          return result;
        }
        case "defstep": {
          const name = symbolName(args[0], at, "defstep");
          const spec = args[1] === undefined ? null : run(args[1], env);
          const field = (key: string) => lookupKey(spec, keyword(key));
          const system = field("system");
          const step: Step = {
            _tag: "Step",
            name,
            system: typeof system === "string" ? system : "—",
            reads: keywordNames(field("reads")),
            writes: keywordNames(field("writes")),
            definedAt: itemOf(at),
          };
          global.define(name, step);
          return step;
        }
        case "sequence":
        case "parallel":
          return {
            _tag: "Flow",
            name: null,
            node: {
              kind: head.name === "sequence" ? "Sequence" : "Parallel",
              children: args.map((arg) => flowNode(run(arg, env), arg.id)),
              at,
            },
          };
        case "branch": {
          const [label, ...body] = args;
          const text = label === undefined ? null : run(label, env);
          if (typeof text !== "string") throw new EvalError("branch needs a label string", at);
          const children = body.map((arg) => flowNode(run(arg, env), arg.id));
          return {
            _tag: "Flow",
            name: null,
            node: {
              kind: "Branch",
              label: text,
              child: children.length === 1 ? children[0]! : { kind: "Sequence", children, at },
              at,
            },
          };
        }
        case "workflow": {
          const name = symbolName(args[0], at, "workflow");
          const flow: Flow = {
            _tag: "Flow",
            name,
            node: {
              kind: "Sequence",
              children: args.slice(1).map((arg) => flowNode(run(arg, env), arg.id)),
              at,
            },
          };
          global.define(name, flow);
          workflows.push(flow);
          return flow;
        }
      }
    }
    const fn = run(head, env);
    return applyFn(
      fn,
      args.map((arg) => run(arg, env)),
      at,
    );
  };

  const applyFn = (fn: Value, args: ReadonlyArray<Value>, at: string): Value => {
    if (isObject(fn) && fn._tag === "Fn") return fn.call(args, at);
    if (isObject(fn) && fn._tag === "Keyword") return lookupKey(args[0] ?? null, fn);
    if (isObject(fn) && fn._tag === "Map") return lookupKey(fn, args[0] ?? null);
    throw new EvalError(`${show(fn)} is not a function`, at);
  };

  const quote = (expr: Expr | undefined): Value => {
    if (expr === undefined) return null;
    switch (expr._tag) {
      case "Symbol":
        return { _tag: "Sym", name: expr.name };
      case "Keyword":
        return keyword(expr.name);
      case "Number":
      case "String":
        return expr.value;
      case "Comment":
        return null;
      case "List":
        return { _tag: "List", items: code(expr.items).map(quote) };
      case "Vector":
        return vector(code(expr.items).map(quote));
      case "Map": {
        const items = code(expr.items).map(quote);
        const entries: Array<readonly [Value, Value]> = [];
        for (let index = 0; index + 1 < items.length; index += 2) {
          entries.push([items[index]!, items[index + 1]!]);
        }
        return { _tag: "Map", entries };
      }
    }
  };

  for (const form of forms) attempt(form, global);

  const globals = new Map([...global.entries()].filter(([name]) => !natives.has(name)));
  return { values, errors, errorSites, globals, workflows, trace };
};
