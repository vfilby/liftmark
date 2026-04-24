import type { APIRoute } from 'astro';

const script = `#!/usr/bin/env sh
# LMWF generate-workout — Claude Code skill installer.
# See https://workoutformat.liftmark.app for docs.
set -eu
DIR="\${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/generate-workout"
BASE="https://workoutformat.liftmark.app/skill"
mkdir -p "$DIR"
curl -fsSL "$BASE/SKILL.md"    -o "$DIR/SKILL.md"
curl -fsSL "$BASE/validate.sh" -o "$DIR/validate.sh"
chmod +x "$DIR/validate.sh"
echo "Installed LMWF generate-workout skill to $DIR"
echo "Start a new Claude Code session to pick up the skill."
`;

export const GET: APIRoute = () => {
  return new Response(script, {
    status: 200,
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
