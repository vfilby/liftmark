import type { APIRoute } from 'astro';
// Same single source of truth as /spec. Served verbatim as text/markdown so
// LLMs, scripts, and the /install.sh skill installer can consume it directly.
import specSource from '../../../liftmark-workout-format/LIFTMARK_WORKOUT_FORMAT_SPEC.md?raw';

export const GET: APIRoute = () => {
  return new Response(specSource, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
