---
"@foldworks/ui": minor
---

Add `TreeDiff`, a structural diff for any two versions of a tree whose nodes
keep their ids. It marks nodes added, removed, moved, or edited, reports a
reordering with the fewest moves, keeps removed nodes where they were, and
shows only the region that changed, folding unchanged runs into a count.
`diffTrees`, `changedRegion`, and `summarizeDiff` are exported. `ChangeSetPreview`
gains a `content` slot for such a view, and its `changes` and `consequences`
are now optional.
