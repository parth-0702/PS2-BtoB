# SiteScope Wizard

UPDATE TO THE PROJECT: change the frontend flow to a guided experience. Keep the backend phases as planned and add the items below.

## Frontend routes / screens

1. `/` Landing page: hero with product name "SiteScope", one-line pitch, animated H3-hexagon background, a "Start analysis" button, and a short 3-step "how it works" strip. No data loading here.

2. `/start` Wizard (single page, stepper with progress bar, back/next, "Skip, use defaults"):

   - Step 1: choose city (cards from GET /cities, each showing name, hex count, and per-layer data coverage).

   - Step 2: business questionnaire, one question per screen. Each question has selectable option chips (single or multi as noted) plus an "Other: write your own" text input. A live summary card updates as answers are given.

   Questions: (1) business type, (2) target customer, (3) attitude to competitors [avoid | neutral | cluster], (4) top priorities [multi-select, ranked top 3], (5) customer travel tolerance [walk 10 | drive 10 | drive 20 | drive 30], (6) hard constraints [multi-select], (7) scale [small | medium | large].

   - Step 3: loading screen with real progress steps (loading city data, building scores, running hot-spot analysis) that call the backend, then navigates to /dashboard.

3. `/dashboard` Main dashboard (all PS features): top bar (city, business summary, "Edit answers" reopening the wizard with current answers, export), left panel (weights, decay, constraints, layer toggles + opacity, layer upload), central MapLibre + deck.gl map (score hexes, Gi* hot/cold overlay, underserved overlay, competitor cluster hulls, isochrones, polygon draw), right tabbed panel (Site details with breakdown + AI explanation + robustness badge, Isochrones with reachable population at 10/20/30, Compare with radar chart for up to 3 sites, Top 3 recommendations), bottom stats strip.

Keep wizard answers in a global store (Zustand) and persist to sessionStorage so refresh does not lose them.

## Backend additions

- POST /questionnaire/resolve {city, answers: {q1..q7 with either option_id or custom_text}} -> returns a full ScoringConfig plus a human-readable "interpretation" list (one line per answer, e.g. "Avoid competitors within 1 km").

  - Deterministic mapping table for predefined options (weights, decay d0, competition mode/radius, constraints, competitor + complementary POI categories, land-use table, default isochrone mode/minutes).

  - Any custom_text goes to the LLM, which returns a validated JSON patch to the config (clamped values, allowed fields only, no invented data). On failure, use the nearest predefined mapping and flag `fallback_used`.

- The dashboard's "Edit answers" calls the same endpoint and re-scores.

- GET /cities must include a coverage summary per layer so the city cards can show it.

## Acceptance checks

- A user can go landing -> city -> 7 questions (mix of chips and custom text) -> loading -> dashboard in under 60 seconds and see a scored map.

- Editing an answer changes the weights and re-colours the map.

- Every PS requirement is reachable from the dashboard without leaving the page.

- Works fully with the synthetic city data.

Implement the new frontend flow and the /questionnaire/resolve endpoint now, then run the app and fix errors.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2afc7b93-b686-4c2f-ace3-016cd7a4b8e9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
