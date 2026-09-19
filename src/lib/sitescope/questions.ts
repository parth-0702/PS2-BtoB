export interface QuestionOption {
  id: string;
  label: string;
  hint?: string;
}

export interface Question {
  id: string;
  title: string;
  subtitle: string;
  multi: boolean;
  maxSelect?: number;
  options: QuestionOption[];
  customPlaceholder: string;
}

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    title: "What kind of business are you opening?",
    subtitle: "This sets which places count as competitors and which help you.",
    multi: false,
    options: [
      { id: "ev", label: "EV charging station" },
      { id: "warehouse", label: "Warehouse / logistics" },
      { id: "cafe", label: "Café / coffee bar" },
      { id: "restaurant", label: "Restaurant" },
      { id: "grocery", label: "Grocery / kirana" },
      { id: "pharmacy", label: "Pharmacy" },
      { id: "gym", label: "Gym / fitness studio" },
      { id: "salon", label: "Salon / spa" },
      { id: "clinic", label: "Clinic" },
      { id: "retail", label: "Apparel & retail" },
    ],
    customPlaceholder: "e.g. artisanal bakery with a small workshop",
  },
  {
    id: "q2",
    title: "Who is your target customer?",
    subtitle: "We use this to weight residents, workers and passers-by.",
    multi: false,
    options: [
      { id: "families", label: "Families & households" },
      { id: "students", label: "Students" },
      { id: "office", label: "Office workers" },
      { id: "young", label: "Young professionals" },
      { id: "tourists", label: "Visitors & tourists" },
      { id: "premium", label: "Premium / high spend" },
    ],
    customPlaceholder: "e.g. night-shift textile workers",
  },
  {
    id: "q3",
    title: "How do you feel about competitors nearby?",
    subtitle: "Some businesses thrive in a cluster, others need clear air.",
    multi: false,
    options: [
      { id: "avoid", label: "Avoid them", hint: "Penalise nearby competitors" },
      { id: "neutral", label: "Neutral", hint: "Barely matters" },
      { id: "cluster", label: "Cluster with them", hint: "Busy strips are good" },
    ],
    customPlaceholder: "e.g. fine within 500 m but not next door",
  },
  {
    id: "q4",
    title: "What matters most to you?",
    subtitle: "Pick up to 3, in order. The first one gets the biggest weight.",
    multi: true,
    maxSelect: 3,
    options: [
      { id: "foot_traffic", label: "Foot traffic" },
      { id: "nearby_customers", label: "Customers living nearby" },
      { id: "low_rent", label: "Low rent" },
      { id: "easy_access", label: "Easy to reach / parking" },
      { id: "low_competition", label: "Little competition" },
      { id: "good_neighbours", label: "Good neighbouring businesses" },
    ],
    customPlaceholder: "e.g. visibility from the main road",
  },
  {
    id: "q5",
    title: "How far will customers travel to you?",
    subtitle: "Sets how quickly a location's pull fades with distance.",
    multi: false,
    options: [
      { id: "walk10", label: "10 min walk" },
      { id: "drive10", label: "10 min drive" },
      { id: "drive20", label: "20 min drive" },
      { id: "drive30", label: "30 min drive" },
    ],
    customPlaceholder: "e.g. most people come by scooter within 15 minutes",
  },
  {
    id: "q6",
    title: "Any hard constraints?",
    subtitle: "Locations that break these are ruled out, not just down-scored.",
    multi: true,
    options: [
      { id: "max_rent", label: "Rent must be affordable" },
      { id: "needs_parking", label: "Needs parking" },
      { id: "ground_floor_commercial", label: "Commercial / ground floor only" },
      { id: "no_flood", label: "Avoid flood-prone areas" },
      { id: "no_industrial", label: "Not in industrial zones" },
      { id: "high_visibility", label: "Main-road visibility" },
    ],
    customPlaceholder: "e.g. must be within 300 m of a bus stop",
  },
  {
    id: "q7",
    title: "How big is the outlet?",
    subtitle: "Bigger formats need reach; small ones live off the street.",
    multi: false,
    options: [
      { id: "small", label: "Small", hint: "Kiosk to 500 sq ft" },
      { id: "medium", label: "Medium", hint: "500 – 2,000 sq ft" },
      { id: "large", label: "Large", hint: "2,000+ sq ft" },
    ],
    customPlaceholder: "e.g. 1,200 sq ft with a 20-seat terrace",
  },
];
