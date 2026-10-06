import { Mentions } from "@foldworks/text-intelligence";
import {
  leaves,
  plainText,
  type Block,
  type Document,
  type TextIntelligence,
} from "@foldworks/editor";
import { crewData } from "../references/crew";

/** The parsed document supplies syntax exclusions; offsets address a leaf's plain text. */
export const referenceOptions = (node: Block): Mentions.Options => {
  if (node.type === "heading" || node.type === "codeBlock")
    return { excluded: [{ from: 0, to: plainText(node).length + 1 }] };
  let at = 0;
  const excluded = node.content.flatMap((run) => {
    const from = at;
    at += run.text.length;
    return run.marks.some((mark) => ["code", "link", "literal"].includes(mark.type))
      ? [{ from, to: at }]
      : [];
  });
  const markdown = Mentions.markdownOptions(plainText(node));
  return { ...markdown, excluded: [...excluded, ...(markdown.excluded ?? [])] };
};
const cachedData = new WeakMap<Document, Mentions.Data>();
const dataFor = (document: Document): Mentions.Data => {
  const cached = cachedData.get(document);
  if (cached) return cached;
  const data = crewData(
    leaves(document)
      .flatMap((node) =>
        Mentions.recognize(plainText(node), referenceOptions(node))
          .filter((mark) => mark.kind === "tag")
          .map((mark) => mark.name),
      )
      .concat(["field-guide", "print", "trail"]),
  );
  cachedData.set(document, data);
  return data;
};

export const referenceIntelligence: TextIntelligence = {
  analyze: (node, document) =>
    Mentions.analyze(plainText(node), dataFor(document), referenceOptions(node)),
  complete: (node, document, caret) => {
    const query = Mentions.queryAt(plainText(node), caret, referenceOptions(node));
    return query && Mentions.suggestions(query, plainText(node), dataFor(document));
  },
  hover: (node, document, offset, source, h) => {
    const description = Mentions.describe(
      plainText(node),
      offset,
      dataFor(document),
      referenceOptions(node),
      source === "Keyboard",
    );
    return description
      ? {
          from: description.from,
          to: description.to,
          content: Mentions.descriptionView(description, h),
        }
      : null;
  },
};
