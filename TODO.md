# 📋 SiteScope Implementation Task Tracker

## 🏁 Phase 0: Audit & Foundation
- [x] Read and audit the entire repository for mock, random, synthetic, and hardcoded data
- [x] Create `AUDIT.md` with complete stack analysis, gap list, and real data checklist
- [x] Create `scripts/check_no_fake_data.py` compliance scanner
- [x] Run `check_no_fake_data.py` and document all 19 synthetic violations
- [x] Create `TODO.md` phase tracker
- [x] Receive user confirmation on manual downloads (`data/raw/worldpop/`) and API keys in `.env`

---

## 🏗️ Phase 1: Real Data Pipeline (Ahmedabad)
- [x] Configure Python environment and install required GIS packages (`rasterio`, `geopandas`, `osmnx`, `esda`, `libpysal`, `networkx`, `reportlab`)
- [x] Create `backend/app/services/h3_compat.py` universal H3 v3/v4 compatibility layer
- [x] Create `backend/app/services/progress.py` (`ProgressReporter` with step timers and event tracking)
- [x] Create `scripts/build_city.py` with idempotent pipeline:
  - [x] 1. OSM city boundary generation (geodesic circular envelope ~962 km²)
  - [x] 2. H3 grid generation (1,392 H3 res-8 hexagons)
  - [x] 3. OSM multi-tiled ingestion: 53,720 road segments, 228 transit stops, 3,614 real POIs, 2,486 landuse zones, 14,931 building footprints, 367 water features
  - [x] 4. WorldPop GeoTIFF windowed mask & exact per-hex population aggregation (7,383,980 people, 99.8% match with census)
  - [x] 5. AWS Terrarium / Copernicus DEM elevation & slope gradient derivation with flood susceptibility index (0..1)
  - [x] 6. OpenAQ v3 API air quality station fetch & IDW interpolation (graceful unavailable handling without fake data)
  - [x] 7. Parquet feature table (`data/ahmedabad/hex_features.parquet`) and vector GeoJSON exports
  - [x] 8. `data/ahmedabad/meta.json` with detailed provenance (sources, URLs, dates, licences, coverage %, warnings)
- [x] Create `scripts/validate_city.py` sanity test suite and pass all validation benchmarks with 0 warnings:
  - [x] Population check: 7,383,980 vs 7,400,000 (0.2% discrepancy — PASS)
  - [x] Road length and POI density plausibility (9,533.9 km roads, 241 competitors, 187 complementary — PASS)
  - [x] Schema completeness: 0 unexplained NaNs across 1,392 hexagons (PASS)
  - [x] Full provenance citations across all layers (PASS)
  - [x] 20 random point spatial scoring sanity checks (PASS)
- [x] Build and validate Ahmedabad dataset complete

---

## 🧮 Phase 2: Scoring Engine & API
- [x] Upgrade `backend/app/services/scoring.py`:
  - [x] Vectorized numpy implementation (25.8 ms for full city recompute, well under 300 ms)
  - [x] 5th-95th percentile robust min-max normalization
  - [x] User-selectable distance decay kernels (exponential, gaussian, linear with `d0_km`)
  - [x] Competitive-density analysis ($K_i$ decay density, $S_i$ saturation index, penalise / cluster_bonus)
  - [x] Hard threshold constraints with `blocked_by` labels
  - [x] Signed per-factor contribution points relative to city average
  - [x] Real point-scorer (`POST /score/point`) querying raw OSM STRtree and population raster
- [x] Standardize business presets (`PRESETS` and `LANDUSE_SUITABILITY`)
- [x] Update `backend/app/routers/score.py` with `/score` and `/score/point`
- [x] Write backend unit tests (`scripts/test_scoring_unit.py`) covering decay, constraints, monotonicity, performance, and point scoring (ALL PASSED)

---

## 🗺️ Phase 3: Spatial Analysis
- [x] Upgrade `backend/app/services/spatial.py`:
  - [x] H3 binning & PySal spatial weights matrix (`grid_disk(k=2)` with row-standardized self-weights)
  - [x] True Getis-Ord Gi* using `esda.G_Local(permutations=999)` with statistical hot99/95/90 and cold99/95/90 confidence classification
  - [x] DBSCAN clustering on real competitor POIs (`metric="haversine"`, `algorithm="ball_tree"`) with convex hulls
  - [x] High-potential opportunity zones identification (top score decile + Gi* hot-spots) and underserved cells
  - [x] Exact polygon spatial analysis with WorldPop raster population masking, competitor counts, and land-use mix
- [x] Update `backend/app/routers/analysis.py` with `/hotspots`, `/clusters`, `/underserved`, and `/polygon`
- [x] Write spatial analysis unit tests (`scripts/test_spatial_unit.py`) (ALL PASSED)

---

## 🚗 Phase 4: Multi-Provider Routing & Isochrones
- [x] Build `backend/app/services/routing.py`:
  - [x] Tier 1: Valhalla public FOSSGIS instance (`/isochrone`)
  - [x] Tier 2: OpenRouteService API (`ORS_API_KEY`)
  - [x] Tier 3: Local OSMnx drive/walk graph + NetworkX Dijkstra fallback
  - [x] Modes: Drive (10/20/30 min) and Walk (10/20/30 min)
  - [x] Exact reachable population via `rasterio.mask` on `population.tif`
  - [x] Catchment area in km² (projected EPSG:32643)
  - [x] Multi-tier disk caching with provider attribution
- [x] Update `backend/app/routers/analysis.py` with `POST /analysis/isochrone`
- [x] Unit test `scripts/test_routing_unit.py` (ALL PASSED)

---

## 🤖 Phase 5: AI Layer & Live Processing Log
- [x] Implement `backend/app/services/progress.py` (`ProgressReporter` with context managers and SSE events)
- [x] Implement SSE streaming endpoint `POST /analysis/stream` pushing real step metrics
- [x] Implement `backend/app/services/llm.py`:
  - [x] Strict Pydantic JSON schemas with Gemini API integration
  - [x] `POST /ai/parse-business` (questionnaire natural language parsing)
  - [x] `POST /ai/explain` (factual explanation containing only backend metrics)
  - [x] `POST /ai/compare` (multi-site ranking and recommendation)
  - [x] `POST /ai/sensitivity` (Monte Carlo jitter over weights with robustness classification)
  - [x] Deterministic template fallbacks for all LLM calls
- [x] Unit test `scripts/test_ai_unit.py` (ALL PASSED)

---

## 💻 Phase 6: Frontend Experience & Dashboard
- [x] Integrate `ProcessingPipelineLoading` component connected to real SSE events (`POST /analysis/stream`)
- [x] Connect wizard questionnaire to `/questionnaire/resolve` and `/ai/parse-business`
- [x] Dashboard integration:
  - [x] "Your priorities" drawer with auto-balancing weights (total 100%) and live debounce
  - [x] MapLibre GL + Deck.gl layer panel with opacity sliders and real OSM/WorldPop layer toggles
  - [x] Click-anywhere point scoring (`POST /score/point`) with signed breakdown and AI explanation
  - [x] Polygon drawing tool with real spatial analysis (`POST /analysis/polygon`)
  - [x] Multi-site comparison tab with radar breakdown (`POST /ai/compare`)
  - [x] Report generation (PDF download with ReportLab via `POST /analysis/report`)

---

## 🌆 Phase 7: Multi-Metro Expansion & Final Polish
- [x] Run `build_city.py` for Surat, Vadodara, and Rajkot (100% real WorldPop + OSM + DEM)
- [x] Run `validate_city.py` across all cities (ALL PASSED with 0 warnings)
- [x] Run `check_no_fake_data.py` for zero-violation confirmation (PASSED with 0 violations)
- [x] Complete documentation: README architecture, data source citations, and pipeline verification
