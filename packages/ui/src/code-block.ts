import { Check, Copy } from "@lucide/icons";
import { Effect } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { rootAttrs, slotAttrs, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { codeBlockStyles as styles } from "./details.styles";
import * as Icon from "./icon";
import { contentStyles } from "./primitive.styles";
import { sxAttrs } from "./sx";

/** Token kinds match `@foldworks/code-editor`'s lexer, so its `highlight` export plugs in directly. */
export type TokenKind =
  | "plain"
  | "keyword"
  | "string"
  | "number"
  | "comment"
  | "type"
  | "property"
  | "punctuation";
export type Token = Readonly<{ text: string; kind?: TokenKind }>;
/** Splits source into lines of tokens. Keep highlighters pure; CodeBlock calls them on every render. */
export type Highlighter = (
  code: string,
  language: string | undefined,
) => ReadonlyArray<ReadonlyArray<Token>>;
export type Slot = "root" | "header" | "title" | "copy" | "viewport" | "pre" | "code";

export type Copy<Message> = Readonly<{
  onCopy: Message;
  /** Swap the button to its confirmed state; the parent clears it, usually after a short delay. */
  isCopied?: boolean;
  label?: string;
  copiedLabel?: string;
}>;

export type ViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    code: string;
    language?: string;
    highlight?: Highlighter;
    /** Header text, such as a file name. The header also appears for `copy`, showing `language` when untitled. */
    title?: string;
    /** Accessible name for the scrollable region. Defaults to `title`, then "Code". */
    ariaLabel?: string;
    /** CSS max height, such as `"240px"`. The code scrolls and becomes keyboard focusable. */
    maxHeight?: string;
    wrap?: boolean;
    lineNumbers?: boolean;
    copy?: Copy<Message>;
  }>;

const kindStyles = {
  plain: undefined,
  keyword: styles.keyword,
  string: styles.string,
  number: styles.number,
  comment: styles.comment,
  type: styles.type,
  property: styles.property,
  punctuation: styles.punctuation,
} as const;

const plainLines = (code: string): ReadonlyArray<ReadonlyArray<Token>> =>
  code.split("\n").map((text) => [{ text }]);

/** Normalizes line endings and drops one trailing newline so snippets don't end with an empty line. */
const normalize = (code: string): string => code.replace(/\r\n?/g, "\n").replace(/\n$/, "");

/** Writes text to the clipboard. Use it inside an application Command that answers `copy.onCopy`. */
export const writeClipboard = (text: string): Effect.Effect<boolean> =>
  Effect.promise(() =>
    globalThis.navigator?.clipboard === undefined
      ? Promise.resolve(false)
      : globalThis.navigator.clipboard.writeText(text).then(
          () => true,
          () => false,
        ),
  );

const tokenView = <Message>(token: Token, h: HtmlBuilder<Message>): Html | string => {
  const style = kindStyles[token.kind ?? "plain"];
  return style === undefined ? token.text : h.span(sxAttrs(h, style), [token.text]);
};

const copyButton = <Message>(
  copy: Copy<Message>,
  config: ViewConfig<Message>,
  isFloating: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const isCopied = copy.isCopied === true;
  const label = isCopied ? (copy.copiedLabel ?? "Copied") : (copy.label ?? "Copy");
  return h.button(
    [
      ...slotAttrs(config.slotProps?.copy, h, styles.copy, isFloating && styles.copyFloating),
      h.Type("button"),
      h.OnClick(copy.onCopy),
      h.AriaLabel(isCopied ? label : `${label} ${config.title ?? "code"}`),
    ],
    [Icon.view({ icon: isCopied ? Check : Copy, size: 14 }, h), label],
  );
};

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const code = normalize(config.code);
  const lines =
    config.highlight === undefined ? plainLines(code) : config.highlight(code, config.language);
  const heading = config.title ?? (config.copy === undefined ? undefined : config.language);
  const hasHeader = heading !== undefined;
  const numberWidth = `${String(lines.length).length}ch`;
  const children =
    config.lineNumbers === true || config.highlight !== undefined
      ? lines.map((line, index) =>
          h.span(sxAttrs(h, styles.line), [
            ...(config.lineNumbers === true
              ? [
                  h.span(
                    [
                      ...sxAttrs(h, styles.lineNumber),
                      h.Style({ minWidth: numberWidth }),
                      h.AriaHidden(true),
                    ],
                    [String(index + 1)],
                  ),
                ]
              : []),
            ...line.map((token) => tokenView(token, h)),
          ]),
        )
      : [code];
  return h.div(
    [
      ...rootAttrs(config, h, styles.root),
      ...(config.language === undefined ? [] : [h.DataAttribute("language", config.language)]),
    ],
    [
      ...(hasHeader
        ? [
            h.div(slotAttrs(config.slotProps?.header, h, styles.header), [
              h.span(slotAttrs(config.slotProps?.title, h, styles.title), [heading]),
              ...(config.copy === undefined ? [] : [copyButton(config.copy, config, false, h)]),
            ]),
          ]
        : config.copy === undefined
          ? []
          : [copyButton(config.copy, config, true, h)]),
      h.div(
        [
          ...slotAttrs(
            config.slotProps?.viewport,
            h,
            styles.viewport,
            config.maxHeight !== undefined && styles.viewportFocusable,
          ),
          ...(config.maxHeight === undefined
            ? []
            : [
                h.Style({ maxHeight: config.maxHeight }),
                h.Role("region"),
                h.AriaLabel(config.ariaLabel ?? config.title ?? "Code"),
                h.Tabindex(0),
              ]),
        ],
        [
          h.pre(
            slotAttrs(
              config.slotProps?.pre,
              h,
              styles.pre,
              config.wrap === true && styles.wrap,
              !hasHeader && config.copy !== undefined && styles.preFloatingCopy,
            ),
            [h.code(slotAttrs(config.slotProps?.code, h, styles.code), children)],
          ),
        ],
      ),
      ...(config.copy === undefined
        ? []
        : [
            h.span(
              [...sxAttrs(h, contentStyles.visuallyHidden), h.Role("status")],
              [config.copy.isCopied === true ? (config.copy.copiedLabel ?? "Copied") : ""],
            ),
          ]),
    ],
  );
};
