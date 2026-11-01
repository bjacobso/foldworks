import { Effect, Schema as S } from "effect";
import { Command } from "foldkit";
import { Analysis } from "./analysis.js";
import { previewEdit } from "./edits.js";
import { FormaHost, call, required } from "./host.js";
import { Message } from "./message.js";
import { localProposer } from "./proposer.js";

export const AskProposer = Command.define("ProposeFormaStructuralEdit", {
  args: {
    basis: Analysis,
    token: S.Number,
    prompt: S.String,
    selectedIds: S.Array(S.String),
    focusId: S.NullOr(S.String),
  },
  messages: [Message.PreparedEdit, Message.AssistantReply, Message.FailedEdit],
  execute: ({ basis, token, prompt, selectedIds, focusId }) =>
    Effect.gen(function* () {
      const { host, config } = yield* FormaHost;
      const describe = yield* required(host, "describeNodes");
      const described = yield* call(() =>
        describe({
          source: basis.document.source,
          identity: basis.document.identity,
          ids: [...new Set([...selectedIds, ...(focusId === null ? [] : [focusId])])],
        }),
      );
      const proposer = config.proposer ?? localProposer;
      const answer = yield* proposer.propose({
        prompt,
        selectedIds,
        focusId,
        nodes: described.nodes,
        analysis: basis,
      });
      if (answer.kind === "reply")
        return Message.AssistantReply({ token, proposer: proposer.name, text: answer.text });
      const proposal = yield* previewEdit(basis, answer.script, answer.title, proposer.name, token);
      return Message.PreparedEdit({ proposal, direct: false });
    }).pipe(Effect.catch((reason) => Effect.succeed(Message.FailedEdit({ token, reason })))),
});
