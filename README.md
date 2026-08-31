# Wildsea Tools

A GitHub Pages site hosting useful tools for running the Wildsea TTRPG.

Built with [Astro](https://astro.build) and TypeScript. Generators are data-driven from
versioned JSON files under `src/data/`.

## Getting started

```sh
npm install
npm run dev
```

## Scripts

| Command                    | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `npm run dev`              | Start the local dev server                     |
| `npm run build`            | Build the production site to `dist/`           |
| `npm run preview`          | Preview the production build locally           |
| `npm run validate:data`    | Validate every generator dataset against schema |
| `npm test`                 | Smoke test generator logic and invariants       |
| `npm run add-option`       | Guided scaffolder for adding generator options |

## Deployment

The site deploys to GitHub Pages automatically via `.github/workflows/deploy.yml` on pushes
to `main`. The Pages source must be set to **GitHub Actions** in the repository settings.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how the data layer works and how to add
options or whole generators.
