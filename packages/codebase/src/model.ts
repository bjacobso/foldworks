export type ChangeKind = "added" | "copied" | "deleted" | "modified" | "renamed" | "type-changed" | "unmerged" | "unknown";

export type ChangeState = "staged" | "unstaged" | "untracked";

export interface RepositoryChange {
  readonly path: string;
  readonly previousPath?: string;
  readonly kind: ChangeKind;
  readonly state: ChangeState;
}

export interface CodebasePackage {
  readonly name: string;
  readonly path: string;
  readonly description?: string;
  readonly version?: string;
  readonly readme?: string;
  readonly dependencies: readonly string[];
}

export interface CodebaseDocument {
  readonly path: string;
  readonly title: string;
  readonly packagePath?: string;
}

export interface RepositorySnapshot {
  readonly title: string;
  readonly rootName: string;
  readonly branch: string;
  readonly head: string;
  readonly baseRef: string;
  readonly generatedAt: string;
  readonly files: readonly string[];
  readonly packages: readonly CodebasePackage[];
  readonly documents: readonly CodebaseDocument[];
  readonly changes: readonly RepositoryChange[];
}

export type DiffScope = "staged" | "unstaged" | "branch";

export interface DiffResult {
  readonly scope: DiffScope;
  readonly path?: string;
  readonly baseRef: string;
  readonly text: string;
}

export interface FileResult {
  readonly path: string;
  readonly language: string;
  readonly text: string;
  readonly size: number;
}

export interface CommitSummary {
  readonly hash: string;
  readonly shortHash: string;
  readonly author: string;
  readonly authoredAt: string;
  readonly subject: string;
}

export interface CodebaseConfig {
  readonly root?: string;
  readonly title?: string;
  readonly baseRef?: string;
  readonly host?: string;
  readonly port?: number;
  readonly maxFileSize?: number;
}

export interface ResolvedCodebaseConfig {
  readonly root: string;
  readonly title: string;
  readonly baseRef: string;
  readonly host: string;
  readonly port: number;
  readonly maxFileSize: number;
}

export const defineCodebase = (config: CodebaseConfig): CodebaseConfig => config;
