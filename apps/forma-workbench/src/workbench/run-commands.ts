import { Effect, Schema as S } from "effect";
import { Command } from "foldkit";
import { Analysis } from "./analysis.js";
import { startRun, resumeRun, RunOutcome } from "./run.js";
import { FormaHost, call, closeValueSession } from "./host.js";
import { Message } from "./message.js";

export const BeginRun = Command.define("RunFormaWithApproval", {
  args: { basis: Analysis, token: S.Number },
  messages: [Message.Ran, Message.FailedRun],
  execute: ({ basis, token }) =>
    startRun(basis, token).pipe(
      Effect.map((outcome) => Message.Ran({ outcome })),
      Effect.catch((reason) => Effect.succeed(Message.FailedRun({ token, reason }))),
    ),
});
export const ResumeRun = Command.define("ResumeApprovedFormaCall", {
  args: { run: RunOutcome, basis: Analysis, allow: S.Boolean },
  messages: [Message.Ran, Message.FailedRun],
  execute: ({ run, basis, allow }) =>
    resumeRun(run, basis, allow).pipe(
      Effect.map((outcome) => Message.Ran({ outcome })),
      Effect.catch((reason) => Effect.succeed(Message.FailedRun({ token: run.token, reason }))),
    ),
});
export const AbortRun = Command.define("AbortSupersededFormaRun", {
  args: { run: RunOutcome },
  messages: [Message.ReleasedAnalysis],
  execute: ({ run }) =>
    Effect.gen(function* () {
      const service = yield* FormaHost;
      const { host } = service;
      if (run.call !== null)
        yield* call(() =>
          host.abortEvaluation({
            sessionId: run.sessionId,
            evaluationId: run.call!.evaluationId,
            reason: "The program changed.",
          }),
        ).pipe(Effect.ignore);
      yield* closeValueSession(service, run.sessionId).pipe(Effect.ignore);
      return Message.ReleasedAnalysis();
    }),
});
