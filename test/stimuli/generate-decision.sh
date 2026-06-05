#!/usr/bin/env bash

mkdir -p situation/stimuli/signals

cat > situation/stimuli/signals/decision-001.md <<'EOF'
Choose between performance and maintainability.
EOF

cat > situation/stimuli/signals/decision-002.md <<'EOF'
Prioritize engineering resources.
EOF

cat > situation/stimuli/signals/decision-003.md <<'EOF'
Determine whether to refactor or rebuild.
EOF
