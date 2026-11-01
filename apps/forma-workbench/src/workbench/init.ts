import type { Update } from "foldkit";
import { CodeEditor } from "@foldworks/code-editor";
import { ValueTree } from "@foldworks/ui";
import { Outliner } from "@foldworks/outliner";

import { ReadProgram } from "./commands.js";
import type { FormaHost } from "./host.js";
import type { Message } from "./message.js";
import { domIds, type Model } from "./model.js";

export type InitConfig = Readonly<{
  /** Prefixes element ids. Unique on the page. */
  id: string;
  /** The program's source. */
  source: string;
  /** Names the program in the title bar. */
  title: string;
}>;

export const init = (config: InitConfig): Update.Return<Model, Message, FormaHost> => ({
  model: {
    id: config.id,
    title: config.title,
    outline: Outliner.init({ id: domIds(config.id).outline }),
    document: null,
    analysis: null,
    prompt: "Wrap selection in do",
    assistantReply: null,
    assistantName: "Local proposer",
    run: null,
    runToken: 0,
    runBusy: false,
    editArgument: "",
    editToken: 0,
    editBusy: false,
    proposal: null,
    pane: "outline",
    source: CodeEditor.init({
      id: `${config.id}-source`,
      uri: config.title,
      languageId: "lisp",
      text: config.source,
      suggestions: "host",
    }),
    sourceDirty: false,
    sourceError: null,
    documents: [],
    notation: "Outline",
    inspector: null,
    valueTree: ValueTree.init({ id: `${config.id}-value` }),
    valueNodes: [],
    failure: null,
  },
  commands: [ReadProgram({ source: config.source })],
});
