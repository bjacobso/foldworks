import { read, type Form } from "@foldworks/code-editor/lisp";

/**
 * A small, synchronous, Clojure-flavored interpreter for the demo REPL. It is
 * deliberately incomplete: no laziness, macros, namespaces, or host interop.
 * Every evaluation has a step budget, so live evaluation cannot hang the page.
 */
export type Value =
  | null
  | boolean
  | number
  | string
  | Readonly<{ t: "kw"; name: string }>
  | Readonly<{ t: "sym"; name: string }>
  | Readonly<{ t: "list" | "vec" | "set"; items: readonly Value[] }>
  | Readonly<{ t: "map"; entries: readonly (readonly [Value, Value])[] }>
  | Readonly<{ t: "fn"; name: string; call: (args: readonly Value[]) => Value }>
  | Readonly<{ t: "re"; source: string }>
  | Readonly<{ t: "var"; name: string }>;

type Coll = Extract<Value, { t: "list" | "vec" | "set" }>;
type MapValue = Extract<Value, { t: "map" }>;

export class LispError extends Error {
  constructor(
    message: string,
    public from = -1,
    public to = -1,
  ) {
    super(message);
  }
}

class Recur {
  constructor(readonly args: readonly Value[]) {}
}

class Env {
  readonly vars = new Map<string, Value>();
  constructor(readonly parent?: Env) {}
  lookup(name: string): Value | undefined {
    return this.vars.has(name) ? this.vars.get(name)! : this.parent?.lookup(name);
  }
}

export type Image = { readonly globals: Env; output: string[]; steps: number };

const kw = (name: string): Value => ({ t: "kw", name });
const vec = (items: readonly Value[]): Value => ({ t: "vec", items });
const list = (items: readonly Value[]): Value => ({ t: "list", items });
const map = (entries: readonly (readonly [Value, Value])[]): MapValue => ({ t: "map", entries });
const fn = (name: string, call: (args: readonly Value[]) => Value): Value => ({
  t: "fn",
  name,
  call,
});
const isObject = (value: Value): value is Exclude<Value, null | boolean | number | string> =>
  typeof value === "object" && value !== null;
const isColl = (value: Value): value is Coll =>
  isObject(value) && (value.t === "list" || value.t === "vec" || value.t === "set");
const isMap = (value: Value): value is MapValue => isObject(value) && value.t === "map";
const truthy = (value: Value) => value !== null && value !== false;

export const equals = (a: Value, b: Value): boolean => {
  if (a === b) return true;
  if (!isObject(a) || !isObject(b)) return false;
  if (isColl(a) && isColl(b)) {
    if ((a.t === "set") !== (b.t === "set") || a.items.length !== b.items.length) return false;
    return a.t === "set"
      ? a.items.every((item) => b.items.some((other) => equals(item, other)))
      : a.items.every((item, index) => equals(item, b.items[index]!));
  }
  if (isMap(a) && isMap(b))
    return (
      a.entries.length === b.entries.length &&
      a.entries.every(([key, value]) => equals(lookup(b, key), value) && has(b, key))
    );
  if ((a.t === "kw" && b.t === "kw") || (a.t === "sym" && b.t === "sym")) return a.name === b.name;
  return false;
};

const has = (m: MapValue, key: Value) => m.entries.some(([candidate]) => equals(candidate, key));
const lookup = (m: MapValue, key: Value, fallback: Value = null): Value =>
  m.entries.find(([candidate]) => equals(candidate, key))?.[1] ?? fallback;
const assoc = (m: MapValue, key: Value, value: Value): MapValue => ({
  t: "map",
  entries: has(m, key)
    ? m.entries.map(
        ([candidate, old]) => [candidate, equals(candidate, key) ? value : old] as const,
      )
    : [...m.entries, [key, value] as const],
});

const typeName = (value: Value): string =>
  value === null
    ? "nil"
    : typeof value === "object"
      ? {
          kw: "keyword",
          sym: "symbol",
          list: "list",
          vec: "vector",
          set: "set",
          map: "map",
          fn: "function",
          re: "regex",
          var: "var",
        }[value.t]
      : typeof value;

/** Every collection-like value as an array; maps yield [key value] vectors. */
const seq = (value: Value): readonly Value[] => {
  if (value === null) return [];
  if (typeof value === "string") return [...value];
  if (isColl(value)) return value.items;
  if (isMap(value)) return value.entries.map(([key, item]) => vec([key, item]));
  throw new LispError(`Don't know how to create a sequence from ${typeName(value)}.`);
};

const number = (value: Value, name: string): number => {
  if (typeof value !== "number")
    throw new LispError(`${name} expects numbers, got ${print(value)}.`);
  return value;
};

const compare = (a: Value, b: Value): number => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  if (isObject(a) && isObject(b) && a.t === "kw" && b.t === "kw")
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  if (a === null) return b === null ? 0 : -1;
  if (b === null) return 1;
  if (isColl(a) && isColl(b)) {
    for (let index = 0; index < Math.min(a.items.length, b.items.length); index++) {
      const result = compare(a.items[index]!, b.items[index]!);
      if (result) return result;
    }
    return a.items.length - b.items.length;
  }
  throw new LispError(`Cannot compare ${print(a)} with ${print(b)}.`);
};

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)));

export const print = (value: Value, readably = true): string => {
  if (value === null) return "nil";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string") return readably ? JSON.stringify(value) : value;
  switch (value.t) {
    case "kw":
      return `:${value.name}`;
    case "sym":
      return value.name;
    case "list":
      return `(${value.items.map((item) => print(item)).join(" ")})`;
    case "vec":
      return `[${value.items.map((item) => print(item)).join(" ")}]`;
    case "set":
      return `#{${value.items.map((item) => print(item)).join(" ")}}`;
    case "map":
      return `{${value.entries.map(([key, item]) => `${print(key)} ${print(item)}`).join(", ")}}`;
    case "fn":
      return `#function[${value.name || "anonymous"}]`;
    case "re":
      return `#"${value.source}"`;
    case "var":
      return `#'user/${value.name}`;
  }
};

/** A multi-line rendering for the transcript: long collections put one element per line. */
export const pretty = (value: Value, indent = 0): string => {
  const flat = print(value);
  if (flat.length + indent <= 72 || !isObject(value)) return flat;
  const pad = " ".repeat(indent + 1);
  if (isMap(value)) {
    const keys = value.entries.map(([key]) => print(key));
    return `{${value.entries
      .map(
        ([, item], index) =>
          `${index ? pad : ""}${keys[index]} ${pretty(item, indent + 2 + keys[index]!.length)}`,
      )
      .join("\n")}}`;
  }
  if (isColl(value)) {
    const [open, close] =
      value.t === "vec" ? ["[", "]"] : value.t === "set" ? ["#{", "}"] : ["(", ")"];
    const inner = " ".repeat(indent + open.length);
    return `${open}${value.items.map((item, index) => `${index ? inner : ""}${pretty(item, indent + open.length)}`).join("\n")}${close}`;
  }
  return flat;
};

const unescape = (source: string) =>
  source.replace(
    /\\(.)/g,
    (_, character: string) => ({ n: "\n", t: "\t", r: "\r" })[character] ?? character,
  );
const characters: Record<string, string> = { space: " ", newline: "\n", tab: "\t", comma: "," };

/** Strip `#_` discards, which the reader keeps as prefix forms. */
const live = (text: string, forms: readonly Form[]) =>
  forms.filter((form) => !(form.kind === "prefix" && text.startsWith("#_", form.from)));

const atomValue = (text: string, form: Form): Value => {
  const token = text.slice(form.from, form.to);
  switch (form.kind) {
    case "string":
      return unescape(text.slice(form.from + 1, form.to - 1));
    case "regex":
      return { t: "re", source: text.slice(form.from + 2, form.to - 1) };
    case "char":
      return characters[token.slice(1)] ?? token.slice(1);
    case "keyword":
      return kw(token.replace(/^::?/, ""));
    case "number": {
      const value = Number(token.replace(/[NM]$/, ""));
      if (Number.isNaN(value)) throw new LispError(`Invalid number ${token}.`, form.from, form.to);
      return value;
    }
    default:
      return token === "nil"
        ? null
        : token === "true"
          ? true
          : token === "false"
            ? false
            : { t: "sym", name: token };
  }
};

/** Quoted forms become data without evaluation. */
const quote = (text: string, form: Form): Value => {
  const children = live(text, form.children);
  switch (form.kind) {
    case "list":
      return list(children.map((child) => quote(text, child)));
    case "vector":
      return vec(children.map((child) => quote(text, child)));
    case "set":
      return { t: "set", items: children.map((child) => quote(text, child)) };
    case "map":
      return map(pairs(children.map((child) => quote(text, child))));
    case "prefix":
      return list([{ t: "sym", name: "quote" }, quote(text, form.children[0]!)]);
    default:
      return atomValue(text, form);
  }
};

const pairs = (items: readonly Value[]): (readonly [Value, Value])[] => {
  const result: (readonly [Value, Value])[] = [];
  for (let index = 0; index < items.length; index += 2)
    result.push([items[index]!, items[index + 1] ?? null]);
  return result;
};

const call = (callee: Value, args: readonly Value[]): Value => {
  if (isObject(callee)) {
    if (callee.t === "fn") return callee.call(args);
    if (callee.t === "kw")
      return isMap(args[0] ?? null)
        ? lookup(args[0] as MapValue, callee, args[1] ?? null)
        : (args[1] ?? null);
    if (callee.t === "map") return lookup(callee, args[0] ?? null, args[1] ?? null);
    if (callee.t === "set")
      return callee.items.find((item) => equals(item, args[0] ?? null)) ?? null;
    if (callee.t === "vec") return callee.items[number(args[0] ?? null, "vector lookup")] ?? null;
  }
  throw new LispError(`${print(callee)} cannot be called as a function.`);
};

/** Binds a symbol, a vector pattern with `&` and `:as`, or a map pattern with `:keys`. */
const bind = (text: string, pattern: Form, value: Value, env: Env) => {
  if (pattern.kind === "symbol") {
    const name = text.slice(pattern.from, pattern.to);
    if (name !== "_") env.vars.set(name, value);
    return;
  }
  if (pattern.kind === "vector") {
    const items = seq(value);
    const parts = live(text, pattern.children);
    for (let index = 0, position = 0; index < parts.length; index++) {
      const part = text.slice(parts[index]!.from, parts[index]!.to);
      if (part === "&") {
        bind(text, parts[++index]!, list(items.slice(position)), env);
        position = items.length;
      } else if (part === ":as") bind(text, parts[++index]!, value, env);
      else bind(text, parts[index]!, items[position++] ?? null, env);
    }
    return;
  }
  if (pattern.kind === "map") {
    const subject = isMap(value) ? value : map([]);
    const parts = live(text, pattern.children);
    for (let index = 0; index + 1 < parts.length; index += 2) {
      const key = text.slice(parts[index]!.from, parts[index]!.to);
      const target = parts[index + 1]!;
      if (key === ":keys")
        for (const name of live(text, target.children)) {
          const symbol = text.slice(name.from, name.to);
          env.vars.set(symbol, lookup(subject, kw(symbol)));
        }
      else if (key === ":as") bind(text, target, value, env);
      else if (key === ":or") continue;
      else bind(text, parts[index]!, lookup(subject, evaluateIn(text, target, env)), env);
    }
    return;
  }
  throw new LispError("Unsupported binding form.", pattern.from, pattern.to);
};

type Arity = Readonly<{ params: readonly Form[]; rest: Form | undefined; body: readonly Form[] }>;

const arity = (text: string, params: Form, body: readonly Form[]): Arity => {
  if (params.kind !== "vector")
    throw new LispError("Function parameters must be a vector.", params.from, params.to);
  const parts = live(text, params.children);
  const amp = parts.findIndex((part) => text.slice(part.from, part.to) === "&");
  return amp < 0
    ? { params: parts, rest: undefined, body }
    : { params: parts.slice(0, amp), rest: parts[amp + 1], body };
};

const makeFn = (text: string, name: string, arities: readonly Arity[], closure: Env): Value => {
  const self: Value = fn(name, (args) => {
    const chosen =
      arities.find((candidate) => !candidate.rest && candidate.params.length === args.length) ??
      arities.find((candidate) => candidate.rest && args.length >= candidate.params.length);
    if (!chosen)
      throw new LispError(`Wrong number of arguments (${args.length}) passed to ${name || "fn"}.`);
    let current = args;
    for (;;) {
      const env = new Env(closure);
      if (name) env.vars.set(name, self);
      chosen.params.forEach((param, index) => bind(text, param, current[index] ?? null, env));
      if (chosen.rest)
        bind(
          text,
          chosen.rest,
          current.length > chosen.params.length ? list(current.slice(chosen.params.length)) : null,
          env,
        );
      const result = body(text, chosen.body, env);
      if (!(result instanceof Recur)) return result;
      current = result.args;
    }
  });
  return self;
};

const body = (text: string, forms: readonly Form[], env: Env): Value | Recur => {
  let result: Value | Recur = null;
  for (const form of forms) result = evaluateTail(text, form, env);
  return result;
};

const fnForm = (
  text: string,
  parts: readonly Form[],
  env: Env,
  named: string | undefined,
): Value => {
  let rest = parts;
  let name = named ?? "";
  if (rest[0]?.kind === "symbol") {
    name = text.slice(rest[0].from, rest[0].to);
    rest = rest.slice(1);
  }
  if (rest[0]?.kind === "string") rest = rest.slice(1);
  if (rest[0]?.kind === "map") rest = rest.slice(1);
  const arities =
    rest[0]?.kind === "list"
      ? rest.map((clause) => {
          const [params, ...forms] = live(text, clause.children);
          return arity(text, params!, forms);
        })
      : [arity(text, rest[0]!, rest.slice(1))];
  return makeFn(text, name, arities, env);
};

/** `#(+ % 1)` becomes a function of %, %1 through %9, and %&. */
const shortFn = (text: string, form: Form, env: Env): Value => {
  const source = text.slice(form.from, form.to);
  const highest = Math.max(
    source.includes("%") && !/%\d/.test(source) ? 1 : 0,
    ...[...source.matchAll(/%(\d)/g)].map((match) => Number(match[1])),
  );
  return fn("", (args) => {
    const scope = new Env(env);
    scope.vars.set("%", args[0] ?? null);
    for (let index = 1; index <= Math.max(highest, 9); index++)
      scope.vars.set(`%${index}`, args[index - 1] ?? null);
    scope.vars.set("%&", list(args.slice(highest)));
    const result = evaluateTail(text, { ...form, open: 1, kind: "list" } as Form, scope, true);
    if (result instanceof Recur) throw new LispError("recur is not supported in #() functions.");
    return result;
  });
};

const evaluateIn = (text: string, form: Form, env: Env): Value => {
  const result = evaluateTail(text, form, env);
  if (result instanceof Recur)
    throw new LispError("recur can only appear in tail position.", form.from, form.to);
  return result;
};

let image: Image | undefined;

const evaluateTail = (text: string, form: Form, env: Env, plain = false): Value | Recur => {
  if (image && ++image.steps > 200_000)
    throw new LispError("Evaluation stopped after 200,000 steps.", form.from, form.to);
  try {
    return evaluateForm(text, form, env, plain);
  } catch (error) {
    if (error instanceof LispError) {
      if (error.from < 0) {
        error.from = form.from;
        error.to = form.to;
      }
      throw error;
    }
    if (error instanceof RangeError)
      throw new LispError(
        "Stack overflow. Use loop and recur for deep recursion.",
        form.from,
        form.to,
      );
    throw error;
  }
};

const evaluateForm = (text: string, form: Form, env: Env, plain: boolean): Value | Recur => {
  const children = live(text, form.children);
  switch (form.kind) {
    case "vector":
      return vec(children.map((child) => evaluateIn(text, child, env)));
    case "set":
      return {
        t: "set",
        items: children
          .map((child) => evaluateIn(text, child, env))
          .filter((item, index, all) => all.findIndex((other) => equals(other, item)) === index),
      };
    case "map":
      return map(pairs(children.map((child) => evaluateIn(text, child, env))));
    case "prefix": {
      const prefix = text.slice(form.from, form.from + form.open);
      const target = form.children[0]!;
      if (prefix === "'" || prefix === "`") return quote(text, target);
      if (prefix === "#'") return { t: "var", name: text.slice(target.from, target.to) };
      if (prefix === "@") throw new LispError("Atoms and deref are not supported in this REPL.");
      return evaluateTail(text, target, env);
    }
    case "list":
      if (form.open === 2 && !plain) return shortFn(text, form, env);
      if (!form.closed) throw new LispError("This list is missing its closing parenthesis.");
      return evaluateList(text, form, children, env);
    case "symbol": {
      const value = atomValue(text, form);
      if (!isObject(value) || value.t !== "sym") return value;
      const found = env.lookup(value.name);
      if (found === undefined) throw new LispError(`Unable to resolve symbol: ${value.name}.`);
      return found;
    }
    default:
      return atomValue(text, form);
  }
};

const symbolName = (text: string, form: Form | undefined) =>
  form?.kind === "symbol" ? text.slice(form.from, form.to) : undefined;

const evaluateList = (
  text: string,
  form: Form,
  children: readonly Form[],
  env: Env,
): Value | Recur => {
  if (!children.length) return list([]);
  const [head, ...args] = children as [Form, ...Form[]];
  const special = symbolName(text, head);
  const at = (index: number) => evaluateIn(text, args[index]!, env);
  switch (special) {
    case "quote":
      return quote(text, args[0]!);
    case "comment":
    case "ns":
    case "require":
      return null;
    case "do":
      return body(text, args, env);
    case "def": {
      const name = symbolName(text, args[0]);
      if (!name) throw new LispError("def needs a symbol name.");
      image!.globals.vars.set(name, args.length > 1 ? evaluateIn(text, args.at(-1)!, env) : null);
      return { t: "var", name };
    }
    case "defn":
    case "defn-": {
      const name = symbolName(text, args[0]);
      if (!name) throw new LispError("defn needs a symbol name.");
      image!.globals.vars.set(name, fnForm(text, args.slice(1), env, name));
      return { t: "var", name };
    }
    case "fn":
      return fnForm(text, args, env, undefined);
    case "let":
    case "loop": {
      const bindings = args[0];
      if (bindings?.kind !== "vector") throw new LispError(`${special} needs a binding vector.`);
      const parts = live(text, bindings.children);
      const scope = new Env(env);
      for (let index = 0; index < parts.length; index += 2)
        bind(text, parts[index]!, evaluateIn(text, parts[index + 1]!, scope), scope);
      if (special === "let") return body(text, args.slice(1), scope);
      for (;;) {
        const result = body(text, args.slice(1), scope);
        if (!(result instanceof Recur)) return result;
        for (let index = 0; index < parts.length; index += 2)
          bind(text, parts[index]!, result.args[index / 2] ?? null, scope);
      }
    }
    case "recur":
      return new Recur(args.map((_, index) => at(index)));
    case "if":
    case "if-not":
      return truthy(at(0)) === (special === "if")
        ? evaluateTail(text, args[1]!, env)
        : args[2]
          ? evaluateTail(text, args[2], env)
          : null;
    case "when":
    case "when-not":
      return truthy(at(0)) === (special === "when") ? body(text, args.slice(1), env) : null;
    case "if-let":
    case "when-let": {
      const parts = live(text, args[0]!.children);
      const value = evaluateIn(text, parts[1]!, env);
      if (!truthy(value))
        return special === "if-let" && args[2] ? evaluateTail(text, args[2], env) : null;
      const scope = new Env(env);
      bind(text, parts[0]!, value, scope);
      return special === "if-let"
        ? evaluateTail(text, args[1]!, scope)
        : body(text, args.slice(1), scope);
    }
    case "cond":
      for (let index = 0; index + 1 < args.length; index += 2)
        if (text.slice(args[index]!.from, args[index]!.to) === ":else" || truthy(at(index)))
          return evaluateTail(text, args[index + 1]!, env);
      return null;
    case "and": {
      let value: Value = true;
      for (let index = 0; index < args.length; index++)
        if (!truthy((value = at(index)))) return value;
      return value;
    }
    case "or": {
      let value: Value = null;
      for (let index = 0; index < args.length; index++)
        if (truthy((value = at(index)))) return value;
      return value;
    }
    case "throw": {
      const value = at(0);
      throw new LispError(
        isMap(value) ? String(lookup(value, kw("message")) ?? print(value)) : print(value, false),
      );
    }
    case "->":
    case "->>": {
      let value = at(0);
      for (const step of args.slice(1)) {
        const stepChildren =
          step.kind === "list" && step.open === 1 ? live(text, step.children) : [step];
        const callee = evaluateIn(text, stepChildren[0]!, env);
        const rest = stepChildren.slice(1).map((child) => evaluateIn(text, child, env));
        value = call(callee, special === "->" ? [value, ...rest] : [...rest, value]);
      }
      return value;
    }
  }
  const callee = evaluateIn(text, head, env);
  return call(
    callee,
    args.map((_, index) => at(index)),
  );
};

// ---------------------------------------------------------------------------
// Core library

type Native = (args: readonly Value[]) => Value;
const variadic =
  (name: string, reduce: (a: number, b: number) => number, identity: number): Native =>
  (args) =>
    args.length === 0
      ? identity
      : args.length === 1 && name === "-"
        ? -number(args[0]!, name)
        : args.length === 1 && name === "/"
          ? 1 / number(args[0]!, name)
          : args
              .slice(1)
              .reduce<number>(
                (total, item) => reduce(total, number(item, name)),
                number(args[0]!, name),
              );
const chain =
  (test: (a: Value, b: Value) => boolean): Native =>
  (args) =>
    args.every((item, index) => index === 0 || test(args[index - 1]!, item));
const str = (value: Value) => (value === null ? "" : print(value, false));
const regex = (value: Value, flags = "") =>
  isObject(value) && value.t === "re"
    ? new RegExp(value.source, flags)
    : typeof value === "string"
      ? value
      : (() => {
          throw new LispError(`Expected a string or regex, got ${print(value)}.`);
        })();
const asString = (value: Value, name: string): string => {
  if (typeof value !== "string")
    throw new LispError(`${name} expects a string, got ${print(value)}.`);
  return value;
};
const getIn = (value: Value, path: readonly Value[]) =>
  path.reduce<Value>(
    (current, key) =>
      isMap(current)
        ? lookup(current, key)
        : isColl(current) && typeof key === "number"
          ? (current.items[key] ?? null)
          : null,
    value,
  );
const assocIn = (value: Value, path: readonly Value[], next: Value): Value => {
  const [key, ...rest] = path;
  const current = isMap(value) ? value : map([]);
  return assoc(
    current,
    key ?? null,
    rest.length ? assocIn(lookup(current, key ?? null), rest, next) : next,
  );
};

const core: Record<string, Native> = {
  "+": variadic("+", (a, b) => a + b, 0),
  "-": variadic("-", (a, b) => a - b, 0),
  "*": variadic("*", (a, b) => a * b, 1),
  "/": (args) => {
    if (args.slice(1).some((item) => item === 0)) throw new LispError("Divide by zero.");
    return variadic("/", (a, b) => a / b, 1)(args);
  },
  inc: ([value]) => number(value ?? null, "inc") + 1,
  dec: ([value]) => number(value ?? null, "dec") - 1,
  mod: ([a, b]) =>
    ((number(a ?? null, "mod") % number(b ?? null, "mod")) + (b as number)) % (b as number),
  rem: ([a, b]) => number(a ?? null, "rem") % number(b ?? null, "rem"),
  quot: ([a, b]) => Math.trunc(number(a ?? null, "quot") / number(b ?? null, "quot")),
  abs: ([value]) => Math.abs(number(value ?? null, "abs")),
  max: (args) => Math.max(...args.map((item) => number(item, "max"))),
  min: (args) => Math.min(...args.map((item) => number(item, "min"))),
  "=": chain(equals),
  "==": chain(equals),
  "not=": (args) => !chain(equals)(args),
  "<": chain((a, b) => compare(a, b) < 0),
  ">": chain((a, b) => compare(a, b) > 0),
  "<=": chain((a, b) => compare(a, b) <= 0),
  ">=": chain((a, b) => compare(a, b) >= 0),
  compare: ([a, b]) => Math.sign(compare(a ?? null, b ?? null)),
  not: ([value]) => !truthy(value ?? null),
  "zero?": ([value]) => value === 0,
  "pos?": ([value]) => number(value ?? null, "pos?") > 0,
  "neg?": ([value]) => number(value ?? null, "neg?") < 0,
  "even?": ([value]) => number(value ?? null, "even?") % 2 === 0,
  "odd?": ([value]) => Math.abs(number(value ?? null, "odd?") % 2) === 1,
  "nil?": ([value]) => value === null,
  "some?": ([value]) => value !== null,
  "number?": ([value]) => typeof value === "number",
  "string?": ([value]) => typeof value === "string",
  "keyword?": ([value]) => isObject(value ?? null) && (value as { t: string }).t === "kw",
  "map?": ([value]) => isMap(value ?? null),
  "vector?": ([value]) => isObject(value ?? null) && (value as { t: string }).t === "vec",
  "coll?": ([value]) => isColl(value ?? null) || isMap(value ?? null),
  "fn?": ([value]) => isObject(value ?? null) && (value as { t: string }).t === "fn",
  "empty?": ([value]) => seq(value ?? null).length === 0,
  "contains?": ([coll, key]) =>
    isMap(coll ?? null)
      ? has(coll as MapValue, key ?? null)
      : isObject(coll ?? null) && (coll as Coll).t === "set"
        ? (coll as Coll).items.some((item) => equals(item, key ?? null))
        : typeof key === "number" && key < seq(coll ?? null).length,
  identity: ([value]) => value ?? null,
  str: (args) => args.map(str).join(""),
  subs: ([value, start, end]) =>
    asString(value ?? null, "subs").slice(
      number(start ?? null, "subs"),
      end === undefined ? undefined : number(end, "subs"),
    ),
  keyword: ([value]) =>
    value === null || value === undefined
      ? null
      : isObject(value) && value.t === "kw"
        ? value
        : kw(str(value)),
  symbol: ([value]) => ({ t: "sym", name: str(value ?? null) }),
  name: ([value]) =>
    isObject(value ?? null) && "name" in (value as object)
      ? (value as { name: string }).name
      : str(value ?? null),
  "parse-long": ([value]) =>
    /^[+-]?\d+$/.test(asString(value ?? null, "parse-long").trim()) ? Number(value) : null,
  "parse-double": ([value]) => {
    const parsed = Number(asString(value ?? null, "parse-double").trim());
    return value === "" || Number.isNaN(parsed) ? null : parsed;
  },
  list: (args) => list(args),
  vector: (args) => vec(args),
  vec: ([value]) => vec(seq(value ?? null)),
  set: ([value]) => ({
    t: "set",
    items: seq(value ?? null).filter(
      (item, index, all) => all.findIndex((other) => equals(other, item)) === index,
    ),
  }),
  "hash-set": (args) => core.set!([list(args)]),
  "hash-map": (args) => map(pairs(args)),
  count: ([value]) =>
    isMap(value ?? null) ? (value as MapValue).entries.length : seq(value ?? null).length,
  first: ([value]) => seq(value ?? null)[0] ?? null,
  second: ([value]) => seq(value ?? null)[1] ?? null,
  last: ([value]) => seq(value ?? null).at(-1) ?? null,
  rest: ([value]) => list(seq(value ?? null).slice(1)),
  next: ([value]) => (seq(value ?? null).length > 1 ? list(seq(value ?? null).slice(1)) : null),
  nth: ([coll, index, fallback]) => {
    const item = seq(coll ?? null)[number(index ?? null, "nth")];
    if (item === undefined && fallback === undefined)
      throw new LispError(`Index ${print(index ?? null)} is out of bounds.`);
    return item ?? fallback ?? null;
  },
  cons: ([item, coll]) => list([item ?? null, ...seq(coll ?? null)]),
  conj: ([coll, ...items]) => {
    const target = coll ?? null;
    if (target === null) return list([...items].reverse());
    if (isMap(target))
      return items.reduce<MapValue>(
        (m, entry) => assoc(m, seq(entry)[0] ?? null, seq(entry)[1] ?? null),
        target,
      );
    if (isColl(target) && target.t === "vec") return vec([...target.items, ...items]);
    if (isColl(target) && target.t === "set") return core.set!([list([...target.items, ...items])]);
    return list([...[...items].reverse(), ...seq(target)]);
  },
  into: ([target, source]) => core.conj!([target ?? null, ...seq(source ?? null)]),
  concat: (args) => list(args.flatMap((item) => seq(item))),
  map: ([f, ...colls]) => {
    const lists = colls.map((coll) => seq(coll));
    const length = Math.min(...lists.map((items) => items.length));
    return list(
      Array.from({ length }, (_, index) =>
        call(
          f ?? null,
          lists.map((items) => items[index]!),
        ),
      ),
    );
  },
  mapv: (args) => vec(seq(core.map!(args))),
  "map-indexed": ([f, coll]) =>
    list(seq(coll ?? null).map((item, index) => call(f ?? null, [index, item]))),
  mapcat: (args) => list(seq(core.map!(args)).flatMap((item) => seq(item))),
  filter: ([f, coll]) => list(seq(coll ?? null).filter((item) => truthy(call(f ?? null, [item])))),
  filterv: ([f, coll]) => vec(seq(coll ?? null).filter((item) => truthy(call(f ?? null, [item])))),
  remove: ([f, coll]) => list(seq(coll ?? null).filter((item) => !truthy(call(f ?? null, [item])))),
  keep: ([f, coll]) =>
    list(
      seq(coll ?? null)
        .map((item) => call(f ?? null, [item]))
        .filter((item) => item !== null),
    ),
  reduce: (args) => {
    const [f, initial, coll] = args.length === 2 ? [args[0], undefined, args[1]] : args;
    const items = seq(coll ?? null);
    if (initial === undefined && !items.length) return call(f ?? null, []);
    return (initial === undefined ? items.slice(1) : items).reduce<Value>(
      (total, item) => call(f ?? null, [total, item]),
      initial === undefined ? items[0]! : initial,
    );
  },
  range: (args) => {
    if (!args.length) throw new LispError("Infinite ranges are not supported here. Pass an end.");
    const [start, end, step] =
      args.length === 1
        ? [0, number(args[0]!, "range"), 1]
        : [
            number(args[0]!, "range"),
            number(args[1]!, "range"),
            args[2] === undefined ? 1 : number(args[2], "range"),
          ];
    if (step === 0 || Math.abs((end - start) / step) > 100_000)
      throw new LispError("That range is too large for this REPL.");
    const items: number[] = [];
    for (let value = start; step > 0 ? value < end : value > end; value += step) items.push(value);
    return list(items);
  },
  repeat: ([count, value]) =>
    list(
      Array.from(
        { length: Math.min(100_000, number(count ?? null, "repeat")) },
        () => value ?? null,
      ),
    ),
  take: ([count, coll]) => list(seq(coll ?? null).slice(0, number(count ?? null, "take"))),
  drop: ([count, coll]) => list(seq(coll ?? null).slice(number(count ?? null, "drop"))),
  "take-while": ([f, coll]) => {
    const items = seq(coll ?? null);
    const end = items.findIndex((item) => !truthy(call(f ?? null, [item])));
    return list(end < 0 ? items : items.slice(0, end));
  },
  "drop-while": ([f, coll]) => {
    const items = seq(coll ?? null);
    const end = items.findIndex((item) => !truthy(call(f ?? null, [item])));
    return list(end < 0 ? [] : items.slice(end));
  },
  partition: ([size, coll]) => {
    const items = seq(coll ?? null);
    const n = number(size ?? null, "partition");
    return list(
      Array.from({ length: Math.floor(items.length / n) }, (_, index) =>
        list(items.slice(index * n, index * n + n)),
      ),
    );
  },
  interpose: ([separator, coll]) =>
    list(seq(coll ?? null).flatMap((item, index) => (index ? [separator ?? null, item] : [item]))),
  reverse: ([coll]) => list([...seq(coll ?? null)].reverse()),
  sort: (args) => {
    const [f, coll] = args.length === 2 ? args : [undefined, args[0]];
    return list(
      [...seq(coll ?? null)].sort((a, b) =>
        f === undefined ? compare(a, b) : number(call(f, [a, b]), "sort comparator"),
      ),
    );
  },
  "sort-by": ([f, coll]) =>
    list(
      [...seq(coll ?? null)].sort((a, b) => compare(call(f ?? null, [a]), call(f ?? null, [b]))),
    ),
  distinct: ([coll]) =>
    list(
      seq(coll ?? null).filter(
        (item, index, all) => all.findIndex((other) => equals(other, item)) === index,
      ),
    ),
  frequencies: ([coll]) =>
    seq(coll ?? null).reduce<MapValue>(
      (m, item) => assoc(m, item, (lookup(m, item, 0) as number) + 1),
      { t: "map", entries: [] },
    ),
  "group-by": ([f, coll]) =>
    seq(coll ?? null).reduce<MapValue>(
      (m, item) => {
        const key = call(f ?? null, [item]);
        return assoc(m, key, vec([...seq(lookup(m, key)), item]));
      },
      { t: "map", entries: [] },
    ),
  some: ([f, coll]) => {
    for (const item of seq(coll ?? null)) {
      const result = call(f ?? null, [item]);
      if (truthy(result)) return result;
    }
    return null;
  },
  "every?": ([f, coll]) => seq(coll ?? null).every((item) => truthy(call(f ?? null, [item]))),
  apply: ([f, ...args]) => call(f ?? null, [...args.slice(0, -1), ...seq(args.at(-1) ?? null)]),
  partial: ([f, ...bound]) => fn("partial", (args) => call(f ?? null, [...bound, ...args])),
  comp: (fs) =>
    fn("comp", (args) =>
      fs.length
        ? fs.slice(0, -1).reduceRight((value, f) => call(f, [value]), call(fs.at(-1)!, args))
        : (args[0] ?? null),
    ),
  juxt: (fs) => fn("juxt", (args) => vec(fs.map((f) => call(f, args)))),
  constantly: ([value]) => fn("constantly", () => value ?? null),
  get: ([coll, key, fallback]) =>
    isMap(coll ?? null)
      ? lookup(coll as MapValue, key ?? null, fallback ?? null)
      : coll === null || coll === undefined
        ? (fallback ?? null)
        : call(coll, [key ?? null, fallback ?? null]),
  "get-in": ([coll, path]) => getIn(coll ?? null, seq(path ?? null)),
  assoc: ([coll, ...rest]) => {
    if (isColl(coll ?? null) && (coll as Coll).t === "vec") {
      const items = [...(coll as Coll).items];
      for (const [key, value] of pairs(rest)) items[number(key, "assoc")] = value;
      return vec(items);
    }
    return pairs(rest).reduce<MapValue>(
      (m, [key, value]) => assoc(m, key, value),
      isMap(coll ?? null) ? (coll as MapValue) : { t: "map", entries: [] },
    );
  },
  "assoc-in": ([coll, path, value]) => assocIn(coll ?? null, seq(path ?? null), value ?? null),
  update: ([coll, key, f, ...args]) => {
    const m = isMap(coll ?? null) ? (coll as MapValue) : (map([]) as MapValue);
    return assoc(m, key ?? null, call(f ?? null, [lookup(m, key ?? null), ...args]));
  },
  dissoc: ([coll, ...keys]) => ({
    t: "map",
    entries: (isMap(coll ?? null) ? (coll as MapValue).entries : []).filter(
      ([key]) => !keys.some((item) => equals(item, key)),
    ),
  }),
  merge: (maps) =>
    maps.reduce<MapValue>(
      (m, next) =>
        isMap(next)
          ? next.entries.reduce<MapValue>((acc, [key, value]) => assoc(acc, key, value), m)
          : m,
      { t: "map", entries: [] },
    ),
  "select-keys": ([coll, keys]) => ({
    t: "map",
    entries: (isMap(coll ?? null) ? (coll as MapValue).entries : []).filter(([key]) =>
      seq(keys ?? null).some((item) => equals(item, key)),
    ),
  }),
  keys: ([coll]) =>
    isMap(coll ?? null) && (coll as MapValue).entries.length
      ? list((coll as MapValue).entries.map(([key]) => key))
      : null,
  vals: ([coll]) =>
    isMap(coll ?? null) && (coll as MapValue).entries.length
      ? list((coll as MapValue).entries.map(([, value]) => value))
      : null,
  zipmap: ([keys, values]) =>
    map(seq(keys ?? null).map((key, index) => [key, seq(values ?? null)[index] ?? null] as const)),
  "ex-info": ([message, data]) =>
    map([
      [kw("message"), message ?? null],
      [kw("data"), data ?? null],
    ]),
  println: (args) => {
    image?.output.push(args.map((item) => print(item, false)).join(" "));
    return null;
  },
  prn: (args) => {
    image?.output.push(args.map((item) => print(item)).join(" "));
    return null;
  },
  "pr-str": (args) => args.map((item) => print(item)).join(" "),
  "str/join": (args) => {
    const [separator, coll] = args.length === 1 ? ["", args[0]] : args;
    return seq(coll ?? null)
      .map(str)
      .join(str(separator ?? null));
  },
  "str/split": ([value, pattern]) =>
    vec(asString(value ?? null, "str/split").split(regex(pattern ?? null))),
  "str/split-lines": ([value]) => vec(asString(value ?? null, "str/split-lines").split(/\r?\n/)),
  "str/upper-case": ([value]) => asString(value ?? null, "str/upper-case").toUpperCase(),
  "str/lower-case": ([value]) => asString(value ?? null, "str/lower-case").toLowerCase(),
  "str/capitalize": ([value]) => {
    const s = asString(value ?? null, "str/capitalize");
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  },
  "str/trim": ([value]) => asString(value ?? null, "str/trim").trim(),
  "str/blank?": ([value]) => value === null || asString(value ?? null, "str/blank?").trim() === "",
  "str/includes?": ([value, part]) =>
    asString(value ?? null, "str/includes?").includes(str(part ?? null)),
  "str/starts-with?": ([value, part]) =>
    asString(value ?? null, "str/starts-with?").startsWith(str(part ?? null)),
  "str/ends-with?": ([value, part]) =>
    asString(value ?? null, "str/ends-with?").endsWith(str(part ?? null)),
  "str/replace": ([value, pattern, replacement]) =>
    asString(value ?? null, "str/replace").replace(
      regex(pattern ?? null, "g") as RegExp,
      str(replacement ?? null),
    ),
};

export const createImage = (): Image => {
  const globals = new Env();
  for (const [name, implementation] of Object.entries(core)) {
    const value = fn(name, implementation);
    globals.vars.set(name, value);
    if (name.startsWith("str/")) globals.vars.set(`clojure.string/${name.slice(4)}`, value);
  }
  return { globals, output: [], steps: 0 };
};

// ---------------------------------------------------------------------------
// Evaluation results the demo stores in its model.

export type Table = Readonly<{
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  total: number;
}>;
export type Outcome = Readonly<{
  from: number;
  to: number;
  source: string;
  status: "value" | "var" | "error";
  inline: string;
  pretty: string;
  output: readonly string[];
  table: Table | null;
}>;

const truncate = (value: string, length: number) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

/** A sequence of maps with keyword keys becomes a table, the most useful view of query-like data. */
const tableOf = (value: Value): Table | null => {
  if (!isColl(value) || value.t === "set" || !value.items.length || !value.items.every(isMap))
    return null;
  const columns: Value[] = [];
  for (const row of value.items as MapValue[])
    for (const [key] of row.entries)
      if (!columns.some((column) => equals(column, key))) columns.push(key);
  if (columns.length > 8) return null;
  return {
    columns: columns.map((column) => print(column)),
    rows: (value.items as MapValue[])
      .slice(0, 50)
      .map((row) =>
        columns.map((column) => truncate(has(row, column) ? print(lookup(row, column)) : "", 40)),
      ),
    total: value.items.length,
  };
};

const summarize = (value: Value): string => {
  const printed = print(value);
  const size = isColl(value) ? value.items.length : isMap(value) ? value.entries.length : 0;
  return printed.length > 64 && size > 1
    ? `${truncate(printed, 56)}  ${size} items`
    : truncate(printed, 72);
};

/** Evaluates each top-level form inside each range, in order, against a persistent image. */
export const evaluateRanges = (
  target: Image,
  source: string,
  ranges: readonly { from: number; to: number }[],
  options: Readonly<{ skipCommentBlocks: boolean }>,
): readonly Outcome[] => {
  const outcomes: Outcome[] = [];
  for (const range of ranges) {
    const slice = source.slice(range.from, range.to);
    for (const form of live(slice, read(slice).forms)) {
      const shifted = { from: range.from + form.from, to: range.from + form.to };
      const code = slice.slice(form.from, form.to);
      if (
        options.skipCommentBlocks &&
        form.kind === "list" &&
        symbolName(slice, form.children[0]) === "comment"
      )
        continue;
      image = target;
      target.output = [];
      target.steps = 0;
      try {
        const value = evaluateIn(slice, form, target.globals);
        const isVar = isObject(value) && value.t === "var";
        outcomes.push({
          ...shifted,
          source: code,
          status: isVar ? "var" : "value",
          inline: summarize(value),
          pretty: pretty(value),
          output: target.output,
          table: tableOf(value),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outcomes.push({
          ...shifted,
          source: code,
          status: "error",
          inline: truncate(message, 72),
          pretty: message,
          output: target.output,
          table: null,
        });
      } finally {
        image = undefined;
      }
    }
  }
  return outcomes;
};

const images = new Map<string, Image>();
/**
 * The live runtime sits outside the Foldkit model, like a REPL process beside an
 * editor. When a restored model refers to an image that no longer exists, a new
 * image loads the file first, like a REPL reconnecting after a restart.
 */
export const imageFor = (key: string, file?: string): Image => {
  let found = images.get(key);
  if (!found) {
    images.set(key, (found = createImage()));
    if (file) evaluateRanges(found, file, read(file).forms, { skipCommentBlocks: true });
  }
  return found;
};
