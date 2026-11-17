# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Where the tracker lives

`.scratch/` is **gitignored** (see `.gitignore`, "Local agent scratch workspace").
It exists only in the main checkout at `E:\Project\KasirKu\.scratch\`.

This matters for any agent working in a **git worktree** — `/implement-spec`
gives each ticket its own worktree, and a fresh worktree contains no `.scratch/`
at all. Read the tickets by **absolute path** from the main checkout:

```
E:\Project\KasirKu\.scratch\kasirku\issues\NN-<slug>.md
```

Write status updates back to that same absolute path, not to a path inside the
worktree. The tracker is deliberately outside version control, so a ticket's
`Status:` change is not part of the commit that closes it.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at
  `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a
  single combined tickets file
- `.scratch/<feature-slug>/issues/INDEX.md` holds the dependency graph and the
  frontier: which tickets are unblocked right now
- Triage state is recorded as a `Status:` line near the top of each issue file
  (see `triage-labels.md` for the role strings)
- Blocking is a `Blocked by: NN, NN` line near the top; a ticket is unblocked
  when every file it lists is resolved
- Comments and conversation history append to the bottom of the file under a
  `## Comments` heading

## Status lifecycle

A ticket's `Status:` line moves through three stages:

1. `needs-triage` / `needs-info` while it is still being shaped
2. `ready-for-agent` (or `ready-for-human`) once it is specified and unblocked
3. **`done`** once it is implemented, reviewed and committed

**`done` is set by whoever finishes the ticket, as the last step of the work** —
not left to a later cleanup pass. That meant the same commit as the feature, or
the one right after it.

`done` is a lifecycle state, not one of the five triage roles. It exists because
the frontier scan depends on it: a ticket stays in the frontier until its file
says `done`, so a stale line hands out already-built work.

## Keeping the frontier honest

`issues/INDEX.md` carries the same status in its table. When a ticket changes
state, update both: the ticket file and the INDEX row. The INDEX is the one a
human reads; the ticket files are the ones the skills read. If they disagree,
the ticket files win.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if
needed), and add its row to `issues/INDEX.md`.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or
the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`,
  with the question in the body. A `Type:` line records the ticket type
  (`research`/`prototype`/`grilling`/`task`); a `Status:` line records
  `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked
  when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open,
  unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set
  `Status: resolved`, then append a context pointer (gist + link) to the map's
  Decisions-so-far in `map.md`.
