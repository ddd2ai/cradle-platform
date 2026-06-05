#!/usr/bin/env bash

set -e

echo ""
echo "🧬 Stimuli is generating."

./test/stimuli/generate-perception.sh
./test/stimuli/generate-decision.sh
./test/stimuli/generate-decomposition.sh
./test/stimuli/generate-learning.sh
./test/stimuli/generate-collaboration.sh
./test/stimuli/generate-creation.sh
./test/stimuli/generate-evolution.sh
./test/stimuli/generate-reflection.sh

echo ""
echo "🧬 Stimuli generated."
