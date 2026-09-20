/**
 * neighborhoods.ts — Verified Landmark & Neighborhood Resolver for Gujarat Metros.
 * Resolves exact hex lat/lng coordinates to the nearest well-known urban district.
 */

interface Neighborhood {
  name: string;
  lat: number;
  lng: number;
  highlight: string;
}

const CITY_NEIGHBORHOODS: Record<string, Neighborhood[]> = {
  ahmedabad: [
    { name: "Navrangpura / CG Road", lat: 23.0365, lng: 72.5611, highlight: "Prime Commercial & Retail Avenue" },
    { name: "SG Highway / Bodakdev", lat: 23.0489, lng: 72.5085, highlight: "Corporate Tech Corridor & Premium Retail" },
    { name: "Vastrapur / IIM Road", lat: 23.0358, lng: 72.5293, highlight: "High Footfall & Student/Professional Catchment" },
    { name: "Prahlad Nagar / Anandnagar", lat: 23.0125, lng: 72.5115, highlight: "High-Income Residential & Dining Hub" },
    { name: "Ashram Road / Riverfront", lat: 23.0305, lng: 72.5714, highlight: "Central Business District & Transit Spine" },
    { name: "Satellite / Shyamal", lat: 23.0185, lng: 72.5285, highlight: "Dense Residential Density & High Demand" },
    { name: "Maninagar / Kankaria", lat: 22.9985, lng: 72.6025, highlight: "Established Commercial Market Area" },
    { name: "Chandkheda / Motera", lat: 23.1085, lng: 72.5855, highlight: "Fast-Growing Northern Metro Suburb" },
    { name: "Gota / Vandematram", lat: 23.0985, lng: 72.5355, highlight: "High Density Residential Expansion" },
    { name: "Thaltej / Shilaj", lat: 23.0555, lng: 72.4925, highlight: "Western Commercial Corridor" },
  ],
  surat: [
    { name: "Vesu / VIP Road", lat: 21.1425, lng: 72.7755, highlight: "Premium High-Growth Retail & Residential" },
    { name: "Adajan / LP Savani", lat: 21.1985, lng: 72.7925, highlight: "Dense Residential Catchment & Active Market" },
    { name: "Athwa Lines / Ghod Dod Road", lat: 21.1755, lng: 72.8085, highlight: "Prime High-Street Retail & Luxury Corridor" },
    { name: "Piplod / Dumas Road", lat: 21.1555, lng: 72.7685, highlight: "Entertainment, Dining & Hospitality Hub" },
    { name: "Ring Road / Textile Market", lat: 21.1885, lng: 72.8455, highlight: "High-Volume Wholesale & Commercial Core" },
    { name: "Pal / Gaurav Path", lat: 21.1825, lng: 72.7715, highlight: "Emerging Western Suburb with High Demand" },
    { name: "City Light / Althan", lat: 21.1625, lng: 72.7955, highlight: "Affluent Residential & Boutique Retail Zone" },
    { name: "Varachha / Mini Bazar", lat: 21.2185, lng: 72.8625, highlight: "Dense Commercial Activity & Transit Access" },
    { name: "Katargam / Gotalawadi", lat: 21.2285, lng: 72.8255, highlight: "Industrial & Mixed Commercial Sector" },
  ],
  vadodara: [
    { name: "Alkapuri / RC Dutt Road", lat: 22.3125, lng: 73.1755, highlight: "Premier Business District & High-End Retail" },
    { name: "Sayajigunj / Station Road", lat: 22.3085, lng: 73.1895, highlight: "Major Transit Hub & University Crowd" },
    { name: "Old Padra Road / Akota", lat: 22.2985, lng: 73.1625, highlight: "Affluent Residential & Commercial Artery" },
    { name: "Fatehgunj / Camp", lat: 22.3255, lng: 73.1885, highlight: "Vibrant Youth, Student & Cafe Hub" },
    { name: "Gotri / Vasna Road", lat: 22.3155, lng: 73.1355, highlight: "Fastest-Growing Western Residential Corridor" },
    { name: "Manjalpur / Makarpura", lat: 22.2685, lng: 73.1955, highlight: "Southern Suburb with Strong Local Demand" },
    { name: "Karelibaug / VIP Road", lat: 22.3285, lng: 73.2085, highlight: "Dense Cultural & Residential Center" },
    { name: "Ellora Park / Subhanpura", lat: 22.3215, lng: 73.1615, highlight: "Established Commercial Strip & Markets" },
    { name: "Sama / Harni Road", lat: 22.3425, lng: 73.2025, highlight: "Northern Residential & Healthcare Sector" },
  ],
  rajkot: [
    { name: "Yagnik Road / Dr. Yagnik Marg", lat: 22.2985, lng: 70.7955, highlight: "City's Core Commercial & Shopping Spine" },
    { name: "Kalawad Road / Amin Marg", lat: 22.2855, lng: 70.7725, highlight: "High-Income Residential & Modern Retail" },
    { name: "150 Feet Ring Road / Big Bazaar", lat: 22.2825, lng: 70.7615, highlight: "Rapidly Expanding Commercial Artery" },
    { name: "University Road / Indira Circle", lat: 22.2925, lng: 70.7785, highlight: "Student Footfall & High Accessibility" },
    { name: "Race Course / Sadar", lat: 22.3055, lng: 70.8015, highlight: "Central Civic, Commercial & Green Spine" },
    { name: "Nana Mava / Mavdi", lat: 22.2685, lng: 70.7755, highlight: "South-Western Residential Growth Belt" },
    { name: "Gondal Road / Bhaktinagar", lat: 22.2755, lng: 70.8085, highlight: "Industrial & Transit Connectivity Hub" },
    { name: "Dhebar Road / Astral", lat: 22.2915, lng: 70.8045, highlight: "Dense Commercial & Electronics Market" },
  ],
};

function distanceSq(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  const dLng = (lng1 - lng2) * Math.cos((lat1 * Math.PI) / 180);
  return dLat * dLat + dLng * dLng;
}

export function resolveNeighborhood(
  cityId: string,
  lat: number,
  lng: number,
  fallbackRank: number = 1
): { name: string; highlight: string } {
  const cityKey = cityId.toLowerCase();
  const list = CITY_NEIGHBORHOODS[cityKey] || CITY_NEIGHBORHOODS["ahmedabad"]!;

  let best = list[0]!;
  let bestDist = Infinity;

  for (const n of list) {
    const d = distanceSq(lat, lng, n.lat, n.lng);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }

  // If distance is reasonable (< 4km), use exact neighborhood
  if (bestDist < 0.002) {
    return { name: best.name, highlight: best.highlight };
  }

  return {
    name: `${best.name} Sector`,
    highlight: best.highlight,
  };
}
