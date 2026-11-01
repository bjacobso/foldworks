import { Effect, Schema as S } from "effect";
import { Command } from "foldkit";
import { Analysis } from "./analysis.js";
import { previewEdit, Script } from "./edits.js";
import { Message } from "./message.js";

export const PrepareEdit = Command.define("PreviewFormaStructuralEdit", {
  args: {
    basis: Analysis,
    script: Script,
    title: S.String,
    proposer: S.String,
    token: S.Number,
    direct: S.Boolean,
  },
  messages: [Message.PreparedEdit, Message.FailedEdit],
  execute: ({ basis, script, title, proposer, token, direct }) =>
    previewEdit(basis, script, title, proposer, token).pipe(
      Effect.map((proposal) => Message.PreparedEdit({ proposal, direct })),
      Effect.catch((reason) => Effect.succeed(Message.FailedEdit({ token, reason }))),
    ),
});
