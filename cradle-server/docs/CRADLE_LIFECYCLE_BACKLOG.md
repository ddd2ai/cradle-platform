# Cradle Lifecycle Backlog

## Current Status

Lifecycle advisor, dry-run planning, and apply safety layer are completed.

Structural lifecycle actions are intentionally disabled by default.

## Deferred Hardening Items

### Repair Execution

- Add lifecycle repair service
- Connect repair action to artifact stabilization
- Support repair type detection

### Lifecycle Event Log

- Record lifecycle decisions
- Record apply results
- Add /lifecycle-events command

### Auto Repair

- Add /watch --auto-repair
- Require repeated repair decisions before execution

### Structural Safety

- Require snapshot before divide / fuse
- Add rollback support
- Add post-apply validation

### Auto Divide

- Enable only after repeated divide decisions
- Require dry-run success
- Require manual or config-based opt-in

### Auto Fuse

- Add compatibility score
- Add fuse plan
- Require manual approval