cat > situation/stimuli/threats/test-compile-failed.md <<'EOF'
# Execution Stimulus

## Source

internal.execution

## Artifact

artifact-test-fail

## Execution

execution-test-fail-001

## Status

compile_failed

## Command

javac HelloService.java

## Stderr

```text
error: file not found: HelloService.java