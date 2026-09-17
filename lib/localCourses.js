// Courses saved manually (e.g. when the GolfCourseAPI lookup doesn't have
// them or the API's daily limit is hit). Shown alongside API search results.

const PARS = [4, 4, 3, 5, 4, 5, 3, 4, 3, 5, 3, 4, 4, 5, 3, 4, 4, 4];
const YARDAGES = [337, 310, 136, 480, 367, 502, 178, 410, 150, 450, 208, 428, 319, 537, 149, 375, 380, 404];

export const LOCAL_COURSES = [
  {
    id: "local-old-bridge-golf-club",
    isLocal: true,
    club_name: "Old Bridge Golf Club",
    tees: {
      unisex: [
        {
          tee_name: "Saved",
          total_yards: YARDAGES.reduce((sum, y) => sum + y, 0),
          par_total: PARS.reduce((sum, p) => sum + p, 0),
          holes: PARS.map((par, i) => ({ par, yardage: YARDAGES[i] })),
        },
      ],
    },
  },
];

export function findLocalCourses(query) {
  const q = query.trim().toLowerCase();
  return LOCAL_COURSES.filter((c) => c.club_name.toLowerCase().includes(q));
}
