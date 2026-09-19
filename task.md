# SiteScope Project - Task Status & Execution Guide

## ✅ COMPLETED PHASES

### Phase 2.1: Backend Endpoint Inventory ✅
- All 12 endpoints tested via curl
- Health, cities, meta, hexes, score, clusters, isochrone, polygon, ai/explain, ai/compare
- Negative tests: 404, 422, 405 responses verified
- Evidence: `/tmp/phase2_evidence.json` (32 entries)

### Phase 2.2: Ingestion Tests ✅
- Wrong CRS (UTM coords) → 200
- Malformed polygon → 422
- Missing polygon field → 422

### Phase 2.3: Scoring Tests ✅
- Default weights → 200, 631 hexes, avg 40.6
- Modified weights → 629/631 hexes changed, max delta 28.3
- Hard constraint → eligible 631→0
- Unknown constraint feature → decay monotonic verified, competition density verified
- Cluster bonus → competition mode flip changes 572/631 hexes
- Score bounds: min=12.6, max=75.8

### Phase 2.4: Clustering Tests ✅
- DBSCAN eps=0.5, ms=3 → 0 clusters
- DBSCAN eps=0.1, ms=10 → 0 clusters
- DBSCAN eps=2.0, ms=2 → 1 cluster (111 points)
- Invalid params → 500 error
- Gi* z-scores: min=-3.58, max=10.28
- Labels: cold99(45), cold95(90), cold90(47), neutral(320), hot90(10), hot95(13), hot99(106)
- High potential: 61, Underserved: 39, Hot: 129, Cold: 182

### Phase 2.5: Routing & Accessibility ✅
- Drive isochrones: 10/20/30 min → pop 242K/634K/890K
- Walk isochrones: 10/20/30 min → pop 15K/55K/111K
- Edge site population differs from center
- MapView hardcoded claims: [248K, 612K, 1240K]
- Independent recompute matches API

### Phase 2.6: Explainability ✅
- 14/631 hexes have |sum(w×sub)-score| > 0.06
- Worst delta: 0.07
- Response missing weights/raw values in payload

### Phase 2.7: Frontend Tests (Browser Automation) ✅
- Playwright + Chromium set up in `/tmp/pw`
- Landing page renders
- "Start Site Analysis" → CityLoadingAnimation → Wizard → ProcessingPipeline → MapView
- Map renders (1 canvas element)
- Click-to-score works
- Layer toggle works
- AI Copilot responds (but returns NaN values in template)
- Compare Sites modal: opens but blank (TypeScript error: `subscores` missing)
- Export Report: triggers TypeScript error (`subscores` missing)

### TypeScript Errors Found (16 errors)
```
src/components/AiExplanation.tsx:24 - Property 'subscores' does not exist on type 'ScoredHex'
src/components/AiVoiceCopilot.tsx:165,166,171,174,186,194 - Properties 'footfall','accessibility','population','rent','competition','floodRisk' missing
src/components/CompareTab.tsx:38,60,118 - Property 'subscores' missing
src/components/HexDetailPanel.tsx:218 - Operator '>' on boolean
src/components/HexMap.tsx:93 - Cannot find namespace 'GeoJSON'
src/components/HexMap.tsx:201,202 - Property 'h3' from index signature
src/components/LayerPanel.tsx:59 - Property 'title' on Lucide icon
src/components/MapView.tsx:75,79,80,94 - Properties 'demand','landuse','risk' missing
src/components/MapView.tsx:82,83 - Property 'decay' (should be 'decayD0')
src/components/MapView.tsx:84,85,86 - Property 'competition' missing
```

---

## ⏳ PENDING TASKS

### Priority 1: Fix TypeScript Errors (Blocking frontend)
1. **Update `ScoredHex` type** in `src/lib/sitescope/types.ts` to include:
   - `subscores?: { demand: number; accessibility: number; complementary: number; competition: number; landuse: number; risk: number }`
   - `footfall?: number; population?: number; rent?: number; floodRisk?: number`
2. **Fix MapView.tsx**: Replace `decay` with `decayD0`, add `competition` to ScoringConfig
3. **Fix HexMap.tsx**: Import GeoJSON types, use `['h3']` bracket notation
4. **Fix LayerPanel.tsx**: Remove `title` prop from Lucide icon
5. **Fix HexDetailPanel.tsx**: Fix boolean > number comparison

### Priority 2: Fix AI Copilot NaN Issue
- In `AiVoiceCopilot.tsx`, the template uses `footfall`, `accessibility`, etc. but backend returns `sub_demand`, `sub_accessibility`, etc.
- Map backend field names to frontend expected names

### Priority 3: Run Full Frontend Test Suite
- After TS fixes, re-run Playwright tests
- Verify Compare Sites modal renders data
- Verify Export Report generates PDF

### Priority 4: Write AUDIT_REPORT.md (Phase 3)
- Document all findings with evidence
- Include backend probe results, frontend test results, TypeScript errors
- List all bugs with severity

---

## 📋 EXECUTION SEQUENCE

### Step 1: Fix TypeScript Types (do first - unblocks everything)
```bash
# 1. Edit types
vi src/lib/sitescope/types.ts
# Add subscores and raw data fields to ScoredHex interface

# 2. Fix MapView.tsx
vi src/components/MapView.tsx
# decay → decayD0, add competition config, fix layer keys

# 3. Fix HexMap.tsx
vi src/components/HexMap.tsx
# Import GeoJSON, use bracket notation for h3

# 4. Fix other files
vi src/components/LayerPanel.tsx
vi src/components/HexDetailPanel.tsx
vi src/components/AiVoiceCopilot.tsx
vi src/components/CompareTab.tsx
vi src/components/AiExplanation.tsx

# 5. Verify
npx tsc --noEmit
```

### Step 2: Fix AI Copilot Field Mapping
```bash
vi src/components/AiVoiceCopilot.tsx
# Map sub_demand → footfall, sub_accessibility → accessibility, etc.
# Or update backend to return expected field names
```

### Step 3: Re-run Frontend Tests
```bash
cd /tmp/pw
node run.js
# Should pass all steps now
```

### Step 4: Write AUDIT_REPORT.md
```bash
vi AUDIT_REPORT.md
# Include: methodology, evidence summary, bugs by severity, recommendations
```

### Step 5: Commit & Push
```bash
git add -A
git commit -m "fix: resolve TypeScript errors, fix AI copilot field mapping, complete Phase 2 audit"
git push
```

---

## 🎯 HOW TO RUN EACH PHASE

### Run Backend Probes (Phase 2.1-2.6)
```bash
/opt/anaconda3/bin/conda run -n sitescope python /tmp/phase2_backend.py
# Output: /tmp/phase2_evidence.json
```

### Run Frontend Browser Tests (Phase 2.7)
```bash
cd /tmp/pw
node run.js
# Or debug versions: node debug5.js
```

### Type Check
```bash
npx tsc --noEmit
```

### Start Dev Servers
```bash
# Terminal 1: Backend
cd backend && /opt/anaconda3/bin/conda run -n sitescope uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
npm run dev
# Serves at http://localhost:8080
```

---

## 📁 KEY FILES & LOCATIONS

| File | Purpose |
|------|---------|
| `/tmp/phase2_backend.py` | Backend probe script |
| `/tmp/phase2_evidence.json` | All probe results (32 tests) |
| `/tmp/pw/run.js` | Playwright test suite |
| `src/lib/sitescope/types.ts` | Core types (needs `subscores` added) |
| `src/components/MapView.tsx` | Main dashboard (multiple TS errors) |
| `src/components/AiVoiceCopilot.tsx` | Copilot (NaN bug + TS errors) |
| `src/components/CompareTab.tsx` | Compare modal (blank due to TS error) |
| `src/components/HexMap.tsx` | Map rendering (GeoJSON import missing) |

---

## 🚨 KNOWN BUGS SUMMARY

| Severity | Component | Issue |
|----------|-----------|-------|
| **Critical** | CompareTab, AiExplanation, AiVoiceCopilot | `subscores` missing from ScoredHex type |
| **Critical** | AiVoiceCopilot | Template uses `footfall`, `population`, `rent` - backend returns `sub_demand`, `pop`, etc. |
| **High** | MapView | `decay` vs `decayD0`, missing `competition` config, wrong layer keys |
| **High** | HexMap | Missing GeoJSON import, index signature access |
| **Medium** | HexDetailPanel | Boolean > number comparison |
| **Medium** | LayerPanel | Invalid `title` prop on Lucide icon |
| **Low** | Backend | Unknown constraint returns 200 instead of 422 |

---

## ✅ NEXT IMMEDIATE ACTION

**Start with Step 1**: Edit `src/lib/sitescope/types.ts` to add `subscores` and raw data fields to `ScoredHex` interface. This single change will fix 8+ TypeScript errors across multiple components.

Then run `npx tsc --noEmit` to verify remaining errors, fix those, then re-run Playwright tests.