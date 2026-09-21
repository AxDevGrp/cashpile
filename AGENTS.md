<!-- orca-per:begin -->
## Pipeline

Use `orca-per "objective"` (or `./scripts/orca-per.sh "objective"`) to launch
supervised Plan → Exec → Review in separate chained Orca worktrees.
The launcher starts a conductor, not a completed pipeline. Planning and review
use Codex gpt-6-astra; execution uses OpenCode configured for GLM5.3.
Plan owns only docs/plans, execution owns product changes (not the plan), and
review owns only docs/reviews with findings, never fixes or automatic merges.
<!-- orca-per:end -->
