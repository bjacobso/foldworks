import { createFoldworksCatalog } from "@foldworks/generative-ui/foldworks";
import { Schema as S } from "effect";

export const releaseCatalog = createFoldworksCatalog({
  review_release: {
    description: "Open the release blockers for a team to review.",
    params: S.Struct({ releaseId: S.String, team: S.String }),
  },
  approve_release: {
    description: "Request approval for a release that is ready to ship.",
    params: S.Struct({ releaseId: S.String }),
  },
});
