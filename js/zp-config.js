/* Course-platform settings (chapter hub, notebook, mocks). Edit values here. */
var ZP_CONFIG = {
  // Web-app URL of automation/zenith-student-data.gs once deployed. While this is "",
  // everything is saved in this browser only (fine for testing; teachers cannot see it).
  // Courses that are on the platform for Trainer, Notebook, Profile... but whose Roadmap page is still the original hand-kept roadmap (every view,
  // percent complete, the old statuses): the platform's chapter path is not used for them. Remove a course from this list to give it the chapter path.
  LEGACY_ROADMAP: ["ap-chemistry"],

  // Sync works like kyj-sat's: pages never wait for the network. Changes are saved in this browser, then sent to the Apps Script (DATA_URL) in one batch at most
  // every SYNC_PUSH_MINUTES, and the script commits them to the repo's data branch. Everything is read straight from GitHub (CLOUD_RAW_URL, the data branch's
  // data/cloud folder) every SYNC_PULL_MINUTES and when a page opens after that long. See automation/zenith-student-data.gs.
  SYNC_PUSH_MINUTES: 5,
  SYNC_PULL_MINUTES: 5,
  CLOUD_RAW_URL: "https://raw.githubusercontent.com/the-zenithway/the-zenithway.github.io/student-data/data/cloud",
  DATA_URL: "https://script.google.com/macros/s/AKfycbwcAO2H2NKVErrYs0_z7MaUWh1U54tETGslsnMTCBUrSQTZl0kCiVM-c8PvTOS4weZh3w/exec",

  // Spaced review uses FSRS-5 (same weights and day-granularity as the SAT site). A note starts the
  // card (first review ~3 days out); each redo is graded Again / Hard / Good / Easy. A card whose
  // next interval reaches RESOLVED_INTERVAL_DAYS leaves the queue as "resolved".
  FSRS_WEIGHTS: [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
    1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621],
  REQUEST_RETENTION: 0.9,
  // Careless problems only need to come back once or twice: lower target recall (fewer, later reviews),
  // and the card resolves after one clean redo. Actual (idea) problems use REQUEST_RETENTION and resolve at RESOLVED_INTERVAL_DAYS.
  CARELESS_RETENTION: 0.8,
  RESOLVED_INTERVAL_DAYS: 30,
  // Entries the student writes for each flagged problem (minimum characters per required box).
  MIN_CARELESS_CHARS: 15,
  MIN_ACTUAL_CHARS: 30,
  // The review queue shows what fits in this many minutes per day; the rest rolls over.
  DAILY_REVIEW_MIN: 15,
  MIN_PER_FRQ: 10,
  MIN_PER_CARD: 1,
  // A later attempt counts as a review only if it is at least this long after the last one (so an immediate
  // "try again" does not count as having remembered it).
  SAME_SESSION_HOURS: 12,
  WARMUP_COUNT: 3,

  // Timed tests / mocks
  MIN_PER_QUESTION: 1.5,
  // AP pacing for tagged Calculus problems: Part A is 60 min for 30 no-calculator questions, Part B is 45 min for 15 calculator ones.
  PACE_NOCALC_MIN: 2,
  PACE_CALC_MIN: 3,
  // A single sitting longer than this gets a "long test" warning.
  LONG_TEST_MIN: 90,
  OVERTIME_SEC: 120,

  // Teacher "needs attention"
  STALLED_DAYS: 5,

  // Older notes carry one of these categories; new entries use Careless / Actual instead (see ENTRY_TYPES).
  ENTRY_TYPES: [
    { key: "careless", label: "Careless", hint: "I knew how to do it and slipped (arithmetic, misread, time)." },
    { key: "actual", label: "Actual", hint: "I did not see the idea, or could not apply it." }
  ],
  MISS_TYPES: [
    { key: "concept", label: "Didn't know the concept", full: true },
    { key: "apply", label: "Knew it, couldn't apply it", full: true },
    { key: "careless", label: "Careless calculation", full: false },
    { key: "misread", label: "Misread the problem", full: false },
    { key: "time", label: "Ran out of time", full: false }
  ],

  // Rough AP 1-5 estimate from MCQ accuracy; placeholder until calibrated.
  AP_ESTIMATE: [[0.75, 5], [0.6, 4], [0.45, 3], [0.3, 2], [0, 1]],

  // Big banks that are not chapters. They leave the B/C/R/T chapter flow and become fixed sets in Practice.
  // prefix picks one Part of a bank by id letter (part/of splits into equal halves instead). calc tags the set's calculator rule. frq marks free-response items.
  SETS: {
    "ap-calculus-bc": [
      // The two misc banks are each divided into a calculator and a no-calculator Part in the source (C11: Part A no calculator,
      // Part B calculator; C12 is the other way round). `prefix` picks the Part by the problem id's first letter.
      { id: "C11A", title: "Misc multiple choice · Part A (no calculator)", chapter: "11", prefix: "A", calc: "no" },
      { id: "C11B", title: "Misc multiple choice · Part B (calculator)", chapter: "11", prefix: "B", calc: "yes" },
      { id: "C12A", title: "Free response · Part A (calculator)", chapter: "12", prefix: "A", calc: "yes", frq: true },
      { id: "C12B", title: "Free response · Part B (no calculator)", chapter: "12", prefix: "B", calc: "no", frq: true }
    ]
  },

  // The core curriculum beyond the chapters (only courses listed here have it; others keep plain chapters).
  //   tOptional    the per-chapter test (T, and its review V) is optional: the cumulative checkpoints replace it.
  //   checkpoints  cumulative tests; each is an 80 minute multiple-choice sitting built in scripts/build_mock_exams.cjs and appears in the
  //                chapter list right after chapter `after`. It becomes due once every chapter in `chapters` is complete.
  //   exam         "Chapter M": required fixed sets, full mocks and past AP free-response exams, taken in this order after the chapters.
  //                kind set = a fixed set (done when every problem is tried), mock = a generated mock or a past AP exam id (done when taken).
  CURRICULUM: {
    "ap-calculus-bc": {
      tOptional: true,
      checkpoints: [
        { id: "cp1", title: "Checkpoint 1 \u00b7 Chapters 1\u20132", chapters: ["1", "2"], after: "2" },
        { id: "cp2", title: "Checkpoint 2 \u00b7 Chapters 3\u20134", chapters: ["3", "4"], after: "4" },
        { id: "cp3", title: "Checkpoint 3 \u00b7 Chapters 5\u20138", chapters: ["5", "6", "7", "8"], after: "8" },
        { id: "cp4", title: "Checkpoint 4 \u00b7 Chapters 9\u201310", chapters: ["9", "10"], after: "10" }
      ],
      exam: { id: "M", title: "Chapter M \u00b7 Exam block", items: [
        { kind: "set", id: "C11A", title: "C11A \u00b7 Mixed multiple choice, no calculator" },
        { kind: "set", id: "C11B", title: "C11B \u00b7 Mixed multiple choice, calculator" },
        { kind: "mock", id: "mock1", title: "Full mock 1" },
        { kind: "mock", id: "ap-2023", title: "2023 AP free-response exam" },
        { kind: "mock", id: "mock2", title: "Full mock 2" },
        { kind: "mock", id: "ap-2024", title: "2024 AP free-response exam" },
        { kind: "mock", id: "mock3", title: "Full mock 3" },
        { kind: "mock", id: "ap-2025", title: "2025 AP free-response exam" }
      ] }
    }
  },

  // Courses that have problem banks. prefix -> data/<prefix>-{c,t}-bank.json
  COURSES: {
    "ap-calculus-bc": { prefix: "calculus", apFrq: true },
    "ap-chemistry": { prefix: "chemistry" }
  }
};
if (typeof module !== "undefined" && module.exports) module.exports = ZP_CONFIG;
