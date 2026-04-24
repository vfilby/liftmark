import type { APIRoute } from 'astro';
// Single source of truth: skill bundled in tools/claude-skill/generate-workout/.
// Served raw so the /install.sh one-liner can curl it directly into
// ~/.claude/skills/generate-workout/.
import skillSource from '../../../../tools/claude-skill/generate-workout/SKILL.md?raw';

export const GET: APIRoute = () => {
  return new Response(skillSource, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
