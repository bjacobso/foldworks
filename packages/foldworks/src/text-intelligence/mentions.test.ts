import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import * as Mentions from "./mentions";
import * as Completion from "./completion";
const data: Mentions.Data = {
  entities: [
    { id: "person-1", kind: "mention", name: "maya", label: "Maya Chen", description: "Lead" },
    { id: "person-2", kind: "mention", name: "maëlle", label: "Maëlle" },
    {
      id: "release-id",
      kind: "tag",
      name: "release",
      label: "Release work",
      description: "Shipping",
    },
  ],
  tags: ["release", "draft", "Draft"],
  unknownMention: (name) => `Unknown @${name}`,
};
const offer = (text: string, caret = text.length, options?: Mentions.Options) =>
  Mentions.suggestions(Mentions.queryAt(text, caret, options)!, text, data);

describe("plain text references", () => {
  it("recognizes Unicode, accents and punctuation with UTF-16 offsets", () => {
    const text = "😀 (@mae\u0308lle),#日本語;@𐐀_name! #release-plan.";
    expect(
      Mentions.recognize(text).map((mark) => [text.slice(mark.from, mark.to), mark.kind]),
    ).toEqual([
      ["@mae\u0308lle", "mention"],
      ["#日本語", "tag"],
      ["@𐐀_name", "mention"],
      ["#release-plan", "tag"],
    ]);
    expect(Mentions.recognize(text)[0]!.from).toBe(4);
    expect(Mentions.recognize("a@maya x#tag \\@maya @ # -#tag")).toEqual([]);
  });
  it("supports surface-specific boundaries and exclusions", () => {
    expect(Mentions.recognize("x/@maya", { boundary: (before) => before === "/" })).toHaveLength(1);
    expect(Mentions.queryAt("@", 1, { excluded: [{ from: 0, to: 1 }] })).toBeUndefined();
    expect(
      Mentions.recognize("@maya #draft", { excluded: [{ from: 1, to: 2 }] }).map(
        (mark) => mark.name,
      ),
    ).toEqual(["draft"]);
  });
  it("filters and replaces the full token in the middle without duplicating punctuation or spaces", () => {
    for (const [source, expected] of [
      ["@mystery, next", "@maya, next"],
      ["@mystery next", "@maya next"],
      ["(@mystery)", "(@maya)"],
    ] as const) {
      const caret = source.indexOf("m") + 1;
      const list = offer(source, caret);
      const chosen = Completion.visible(list, source, caret)[0]!;
      const result = Completion.accept(list, source, chosen);
      expect(result.text).toBe(expected);
      expect(result.caret).toBe(source.indexOf("@") + "@maya".length);
    }
    const list = offer("@");
    expect(Completion.accept(list, "@", list.items[0]!).text).toBe("@maya ");
    expect(Mentions.queryAt("@𐐀", 2)).toBeUndefined();
  });
  it("matches host labels, normalized accents and a finished prefix with unfinished suffix", () => {
    expect(Completion.visible(offer("@chen"), "@chen", 5)[0]?.label).toBe("@maya");
    expect(Completion.visible(offer("@mae\u0308"), "@mae\u0308", 5)[0]?.label).toBe("@maëlle");
    expect(Completion.visible(offer("@mayaSuffix", 5), "@mayaSuffix", 5)[0]?.label).toBe("@maya");
  });

  it("resolves stable identities without turning text into nodes", () => {
    const description = Mentions.describe("@MAYA", 1, data)!;
    expect(description.entity.id).toBe("person-1");
    expect(description.title).toBe("Maya Chen");
    expect(
      Schema.decodeUnknownSync(Mentions.Entity)(JSON.parse(JSON.stringify(description.entity))),
    ).toEqual(description.entity);
    expect(Mentions.analyze("@stranger #draft", data).diagnostics[0]?.message).toBe(
      "Unknown @stranger",
    );
    expect(Mentions.analyze("@stranger", { entities: [] }).diagnostics).toEqual([]);
    expect(Mentions.describe("@stranger", 1, data)).toBeUndefined();
    expect(Mentions.describe("@maya", 5, data, {}, true)?.entity.id).toBe("person-1");
  });
  it("deduplicates document tags and lets host tag data take precedence", () => {
    expect(Mentions.tagsIn(["#Draft #draft", "#日本語 #draft"])).toEqual(["draft", "日本語"]);
    const list = offer("#");
    expect(list.items.map((item) => item.label)).toEqual(["#release", "#draft"]);
    expect(Mentions.describe("#release", 2, data)?.entity.id).toBe("release-id");
  });
});

describe("Markdown query boundaries", () => {
  it("excludes headings, emails, URLs, escapes, code spans and fences", () => {
    const text =
      "# Heading @maya\n\nhello@maya.com https://host/#draft mailto:a@maya\n\\@maya \\#draft `@maya` ``#draft``\n```md\n@maya #draft\n```\n~~~\n@maya\n~~~\n    @maya\n<https://host/#draft> [site](https://host/@maya)\nNow @maya and #draft.";
    const options = Mentions.markdownOptions(text);
    expect(Mentions.recognize(text, options).map((mark) => text.slice(mark.from, mark.to))).toEqual(
      ["@maya", "#draft"],
    );
    for (const match of text.matchAll(/[@#]/gu)) {
      if (match.index < text.lastIndexOf("Now"))
        expect(Mentions.queryAt(text, match.index + 1, options)).toBeUndefined();
    }
    const open = "```\n@";
    expect(Mentions.queryAt(open, open.length, Mentions.markdownOptions(open))).toBeUndefined();
  });
});
