import type { APIRoute } from 'astro';
import validateScript from '../../../../tools/claude-skill/generate-workout/validate.sh?raw';

export const GET: APIRoute = () => {
  return new Response(validateScript, {
    status: 200,
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
