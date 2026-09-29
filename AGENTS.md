## Pipeline

Stages are executed directly in the working checkout. The primary reviews and
accepts each stage's evidence (baseline, diff, findings) before the next stage
begins. Keep execution evidence outside `docs/plans`; the frozen plan is not
edited to record acceptance.
