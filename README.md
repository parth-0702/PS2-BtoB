# 🌐 SiteScope — AI-Powered Geospatial Site Recommendation Platform

> **Bit N Build '26 | PS2 B2B Spatial Intelligence Solution**  
> *Next-Generation Enterprise Location Selection & Spatial Decision Analysis Engine*

---

SiteScope is an advanced, AI-powered geospatial site selection platform designed to help businesses, retail chains, urban planners, and enterprise decision-makers discover optimal physical site locations. Powered by **Uber H3 hexagonal spatial indexing**, **Multi-Criteria Decision Analysis (MCDA)**, **Getis-Ord Gi\* spatial autocorrelation**, **distance decay modeling**, and an **interactive AI Voice Copilot**, SiteScope transforms complex geospatial datasets into actionable location intelligence.

---

## 📸 Visual Aesthetic & Theme

SiteScope features a **"Deep Ocean + Light"** enterprise theme built using modern **OKLCH color spaces**:
* **Theme Palette**: Crisp light enterprise container background (`oklch(0.977 0.005 210)`), deep navy map basemap styling (`#102A43`), and vibrant turquoise action accents (`#16C6B5`).
* **Typography**: **Space Grotesk** for display titles, **Plus Jakarta Sans** for body readability, and **IBM Plex Mono** for geospatial metrics and H3 indexes.
* **Glassmorphism & Micro-animations**: Panel shadows, smooth spatial hover state transitions, and responsive floating hexagon hero visuals.

---

## ✨ Key Features

### 1. 🧙 Guided Setup Wizard (`/start`)
* **City Selection**: Choose from supported metropolitan areas (e.g. Mumbai, Bengaluru, Delhi, Hyderabad) with real-time layer coverage metrics and total H3 hexagon counts.
* **7-Step Adaptive Business Questionnaire**:
  1. *Business Type* (Retail, QSR, Logistics, Healthcare, Fitness, etc.)
  2. *Target Demographic* (Youth, Families, High-Income Professionals, Seniors, Students)
  3. *Competitor Strategy* (Avoid Competitors, Neutral, Cluster / Co-locate)
  4. *Top Strategic Priorities* (Ranked top 3 choices)
  5. *Customer Travel Tolerance / Catchment* (10/20/30-min walk/drive)
  6. *Hard Constraints* (e.g. max rent budget, flood risk tolerance, land-use zoning)
  7. *Physical Footprint Scale* (Small, Medium, Large)
* **AI Natural Language Custom Input**: Type custom requirements in plain English (e.g., *"Looking for high footfall near tech parks with low competition within 1.5km"*), resolved dynamically via FastAPI NLP logic with Pydantic JSON validation.

### 2. 🗺️ Interactive Geospatial Dashboard (`/dashboard`)
* **Uber H3 Hexagonal Grid Visualization**: High-resolution spatial indexing (Res 8/9) rendering thousands of spatial cells simultaneously using **MapLibre GL JS** + **Deck.gl**.
* **Layer Control System**:
  * 🎯 **MCDA Suitability Score**: Color-coded suitability heatmap (0–100 scale).
  * 🔥 **Getis-Ord Gi\* Hotspots & Coldspots**: Statistically significant spatial clustering ($Z$-score $> 1.65$ / $< -1.65$).
  * 🔍 **Underserved Demand Overlay**: Identifies high-demand, low-competition gap areas.
  * ⏱️ **Isochrone Buffer Rings**: 10, 20, and 30-minute reachable catchment polygons.
  * 🏬 **Competitor Hulls (DBSCAN)**: Convex hull polygons identifying competitive cluster zones.
  * 📁 **Custom Layer Upload**: Support for external GeoJSON dataset ingestion with opacity controls.
* **Dynamic Real-Time Re-Scoring**:
  * Interactive weight sliders for Footfall, Population Density, Accessibility, Complementary POIs, Competition, Land Use, and Risk.
  * Distance decay curve controls (Exponential $e^{-\lambda d}$ / Gaussian $e^{-(d/d_0)^2}$).
  * Instant real-time map re-rendering upon weight adjustments.

### 3. 📊 Site Intelligence & Multi-Site Comparison
* **Hexagon Detail Breakdown**: Subscore breakdown across Demand, Accessibility, Complementary POIs, Competition, Land Use Suitability, and Environmental Risk.
* **Robustness & Suitability Badges**: Evaluates sensitivity of site score against weight variations.
* **Side-by-Side Comparison Drawer**: Select and compare up to 3 candidate H3 hexagon locations simultaneously using interactive **Recharts Radar Charts** and differential metric grids.
* **Isochrone Reach Analysis**: Compute reachable population counts across 10, 20, and 30-minute walk/drive thresholds.
* **Polygon Containment Tool**: Draw custom polygon boundaries directly on the map to analyze aggregated population, footfall, competitor counts, and dominant land-use zoning inside the selection.

### 4. 🎙️ AI Voice & Text Copilot
* **Context-Aware Spatial Assistant**: Integrated floating copilot (`AiVoiceCopilot.tsx`) supporting voice and text commands.
* **Instant Site Explanation**: Explains *why* a specific hexagon is rated high/low based on subscore contributions and surrounding spatial features.
* **Zero NaN Guarantee**: Fully sanitized data extraction pipeline eliminating invalid numeric state rendering.

### 5. 📄 Executive Report Export
* Export comprehensive site assessment reports to **PDF**, **JSON**, and **CSV** for enterprise decision-makers and stakeholders.

---

## 🏗️ Architecture & Technology Stack

### Frontend Stack
* **Framework**: [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/) + [TanStack Start](https://tanstack.com/start) / [TanStack Router](https://tanstack.com/router)
* **State Management**: [Zustand](https://github.com/pmndrs/zustand) with `sessionStorage` persistence
* **Mapping Engine**: [MapLibre GL JS](https://maplibre.org/) + [Deck.gl v9](https://deck.gl/) (`@deck.gl/mapbox`) + [`h3-js`](https://github.com/uber/h3-js)
* **Data Visualization**: [Recharts](https://recharts.org/) (Radar charts, Bar charts, Metric distribution histograms)
* **Styling & UI**: [Tailwind CSS v4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) primitives + [Lucide Icons](https://lucide.dev/) + [Sonner](https://sonner.emilkowal.ski/) toasts
* **Build System**: `@lovable.dev/vite-tanstack-config`

### Backend Stack
* **Framework**: [Python 3.11+](https://www.python.org/) + [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/)
* **Spatial & Data Science**:
  * [`h3-py`](https://github.com/uber/h3-py): Uber H3 Python binding for spatial indexing
  * [`geopandas`](https://geopandas.org/) & [`shapely`](https://shapely.readthedocs.io/): Vector spatial analysis & geometry operations
  * [`scikit-learn`](https://scikit-learn.org/) & [`scipy`](https://scipy.org/): Spatial clustering (DBSCAN) & Getis-Ord Gi\* statistics
  * [`pandas`](https://pandas.pydata.org/) & [`numpy`](https://numpy.org/): Fast tabular spatial feature aggregation
  * [`pydantic`](https://docs.pydantic.dev/): Strict data validation and schema definitions

---

## 📁 Repository Structure

```
PS2-BtoB/
├── backend/                         # Python FastAPI Backend
│   ├── app/
│   │   ├── main.py                  # Application entrypoint & CORS middleware
│   │   ├── routers/
│   │   │   ├── cities.py            # City metadata & layer coverage endpoints
│   │   │   ├── score.py             # MCDA Spatial scoring engine
│   │   │   ├── analysis.py          # Spatial analysis (DBSCAN clusters, Isochrones, Polygon containment)
│   │   │   └── ai.py                # AI explanation generation endpoint
│   │   └── services/
│   │       ├── scoring.py           # Core spatial MCDA & Gi* calculations
│   │       ├── spatial.py           # Isochrone & DBSCAN spatial functions
│   │       └── ai.py                # LLM natural language prompt resolution
│   ├── data/                        # Synthetic spatial data (Parquet / JSON per city)
│   ├── scripts/                     # Data synthesis & spatial preprocessing scripts
│   └── requirements.txt             # Python backend dependencies
├── src/                             # React / TanStack Start Frontend
│   ├── components/                  # UI Components
│   │   ├── HexMap.tsx               # MapLibre + Deck.gl H3 layer rendering
│   │   ├── MapView.tsx              # Main dashboard view orchestrator
│   │   ├── Wizard.tsx               # 7-step interactive wizard setup
│   │   ├── LandingPage.tsx          # Hero page with animated H3 background
│   │   ├── AiVoiceCopilot.tsx       # Floating AI voice/text spatial copilot
│   │   ├── HexDetailPanel.tsx       # Selected hex metrics & subscore drawer
│   │   ├── CompareTab.tsx           # Multi-site side-by-side radar comparison
│   │   ├── IsochroneTab.tsx         # Reachable population catchment breakdown
│   │   ├── AdjustWeightsDrawer.tsx  # Dynamic weight & decay adjustment panel
│   │   └── MapLayersPanel.tsx       # Map overlays & opacity controls
│   ├── lib/                         # Client-side spatial scoring & state
│   │   ├── sitescope/
│   │   │   ├── store.ts             # Zustand global store & persistence
│   │   │   ├── scoring.ts           # Client-side scoring fallback engine
│   │   │   ├── resolve.ts           # Questionnaire mapping & config resolver
│   │   │   ├── questions.ts         # Questionnaire question configurations
│   │   │   └── types.ts             # TypeScript interface definitions
│   │   ├── api.ts                   # Axios/Fetch API client for FastAPI
│   │   └── export.ts                # PDF/JSON site report exporter
│   ├── routes/                      # TanStack Router route definitions
│   │   ├── __root.tsx               # App root layout & providers
│   │   └── index.tsx                # Main view router (Landing / Wizard / Dashboard)
│   └── styles.css                   # Deep Ocean + Light theme OKLCH design system
├── sitescope_audit_report.md        # Comprehensive quality & type audit report
├── task.md                          # Problem statement & task documentation
├── package.json                     # Frontend dependencies & scripts
├── vite.config.ts                   # Vite configuration
└── README.md                        # Project README documentation
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **Python**: v3.11 or higher

---

### 1. Frontend Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd PS2-BtoB
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:8080` (or `http://localhost:5173`).

---

### 2. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI backend server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   The FastAPI interactive documentation will be available at `http://127.0.0.1:8000/docs`.

---

## 🔌 API Reference

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `GET /cities` | `GET` | List supported cities with hexagon counts and layer coverage metadata |
| `GET /cities/{id}/hexes` | `GET` | Retrieve H3 hex grid features for a given city |
| `POST /questionnaire/resolve` | `POST` | Map questionnaire answers / NLP custom text into a `ScoringConfig` payload |
| `POST /score` | `POST` | Calculate spatial MCDA suitability scores & Gi\* hotspots |
| `POST /analysis/clusters` | `POST` | Compute DBSCAN spatial clusters for competitor density analysis |
| `POST /analysis/isochrone` | `POST` | Generate travel time buffers & reachable population stats (10/20/30 mins) |
| `POST /analysis/polygon` | `POST` | Compute containment statistics inside user-drawn map polygon |
| `POST /ai/explain` | `POST` | Generate natural language AI rationale for a selected site |

---

## 🧪 Quality & Type Validation

The SiteScope repository has undergone rigorous verification:
* **TypeScript Compilation**: `0` errors (`npx tsc --noEmit` returns exit code `0`).
* **Production Build**: Passes `npm run build` cleanly.
* **Runtime Verification**: All copilot response generators include metric extraction fallbacks to prevent `NaN` values.

---

## 📜 Hackathon Context & Acknowledgments

Built for **Bit N Build '26** — **PS2: AI-Powered GeoSpatial Site Recommendation Platform (B2B)**.

Designed and engineered to empower modern enterprises with seamless location intelligence.
