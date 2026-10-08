# The Wildsea TTRPG tool site

## Goal

Create a site that will serve useful tools for running the Wildsea TTRPG.

The site will be deployed and served through Github Pages, so should only use design choices that will work within that deployment framework.

## Site tools (brainstorm)

This site will serve:

1) A landing page that serve as the gateway to the rest of the site content. It will display all available tools, and provide on-page quick access to specified tools.
2) A tool for generating random Watch Roll result prompts for Firefly inspiration
3) A tool for generating random Weather Condition prompts for Firefly inspiration
4) A tool for generating random Ships for NPC ships
5) A tool for generating random NPC prompts for Firefly inspiration
6) A tool for generating random points of interest for populating Spits, Tallshanks, and Islands
7) A tool for selecting random hazard encounters, including suggested encounter tracks and suggested variants for difficulty 

## Project TODOS:

1) Decide on project architecture. Look for feature rich but easy to maintain project architectures for github pages sites.
2) Decide on architecture for storing generator options. Generators are data-driven from these options. Ideally these generator options are easily appended to as new ideas are thought up.
3) Generate the first tool for the project: A random Ship generator. All options for ship parts should come from the Wildsea Core Rules ship building section.
4) Generate the Landing Page for the project
## Status

1. ~~Decide on project architecture.~~ Astro + TypeScript, data-driven JSON generators, static output for GitHub Pages.
2. ~~Decide on architecture for storing generator options.~~ One folder per tool under `src/data/`; schema-validated collections; validation and smoke tests in CI.
3. ~~Generate the first tool: a random Ship generator.~~ Complete (Core Rules shipbuilding content).
4. ~~Generate the Landing Page.~~ Complete; it lists every active tool from `src/data/manifest.json`.
5. Watch Results tool. Complete: core watch table plus all six reach tables, selectable.
6. Weather Conditions tool. Complete: weather-watching results and clear skies / continuation / change for the worse outcomes.
7. Points of Interest tool. Complete: land features (Spit, Tallshank, Island, Reef), per-layer sensory details, hooks/encounters, and sample resources from the Firefly's Guide layer entries.
8. Hazards tool. Complete first pass: all eight Chapter 10 categories (66 named hazards plus basic forces of nature), with generated encounter limits and tracks. General ("Any") draws exclude forces of nature (added as a 10% backdrop condition instead) and leviathans (opt-in via a toggle); either can still be chosen directly by category. Deeper per-hazard detail (presence, aspects, quirks, resources) is a planned follow-up.
9. Journey Dashboard. Complete: one page composing the watch, weather, points-of-interest,
   and hazard tools into a leg of the journey, with whole-leg and per-panel rerolls. Four
   quarter-width columns, each independently scrollable. Linked from the site toolbar and the
   landing page's Quick Sparks. Watch and weather selects show their d6 mapping (including the
   reach sub-table d6), so a Firefly can enter the dice the crew actually rolled.

### Notes / follow-ups

- Hazard summaries are paraphrased from the core rules; full per-hazard aspects, quirks, presence, and resources are not yet captured.
- NPC prompt tool (brainstorm item 5) is still unstarted.
