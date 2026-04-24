import type { APIRoute } from 'astro';

const body = `# LiftMark Workout Format (LMWF)

LMWF is a markdown-based format for strength training workouts. It is human-writable and machine-parseable. Used by the LiftMark iOS app (https://liftmark.app) but open for any tooling.

## Docs

- [Full spec](https://workoutformat.liftmark.app/spec.md): Complete LMWF format specification in markdown.
- [Validator API](https://workoutformat.liftmark.app/validate): POST JSON \`{"markdown": "..."}\` to validate LMWF content. Returns \`{success, summary, errors, warnings}\`.

## Optional

- [Claude Code skill installer](https://workoutformat.liftmark.app/install.sh): One-line installer (\`curl -fsSL https://workoutformat.liftmark.app/install.sh | sh\`) for a skill that generates and validates LMWF workouts.
`;

export const GET: APIRoute = () => {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
