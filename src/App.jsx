// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { setDoc, onSnapshot } from "firebase/firestore";
import { plannerDoc } from "./firebase";
import {
  Calendar as CalendarIcon,
  CheckSquare,
  ListTodo,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Layers,
  Clock,
  CheckCircle2,
  X,
  Edit3,
  LayoutGrid,
  CalendarDays,
  CalendarRange,
} from "lucide-react";

/* =========================================================
   Personal Planner — stable whole file
   - Add Task modal (routine/one-time) + subtasks (no double adds)
   - Routine To-Do filters by selected day (chips), default = today
   - Routine parent & subtask checkboxes write to selected day (immutable)
   - One-time subtasks toggle completed (immutable)
   - Subtasks start collapsed; subtasks can be deleted
   - "Priority" label (was Eisenhower)
   - Calendars Month/Week/Day preserved
   - Calendar FIX: local dates (no UTC offset)
   - Import/Export JSON buttons
   ========================================================= */

// --- Utilities ---
const uid = () => Math.random().toString(36).slice(2);

// Local-time YYYY-MM-DD (no UTC jump)
const toLocalISO = (d) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const todayISO = () => toLocalISO(new Date());
const fmtISO = (d) => toLocalISO(d);

const addDays = (d, n) => {
  const dd = new Date(d);
  dd.setDate(dd.getDate() + n);
  return dd;
};
const startOfWeek = (d) => {
  const dd = new Date(d);
  const dif = dd.getDay(); // Sunday=0
  dd.setDate(dd.getDate() - dif);
  dd.setHours(0, 0, 0, 0);
  return dd;
};
const endOfWeek = (d) => addDays(startOfWeek(d), 6);

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Extract the most meaningful word from a task title for compact display
const SKIP_WORDS = new Set([
  "have","a","an","the","on","in","at","to","for","of","with",
  "before","after","up","healthy","practice","study","work","read",
]);
const shortTitle = (title) => {
  const words = title.split(" ");
  const key = words.find((w) => !SKIP_WORDS.has(w.toLowerCase())) || words[0];
  return key.charAt(0).toUpperCase() + key.slice(1);
};

// --- Storage / initial state ---
const STORAGE_KEY = "personal_tasks_calendar_app_v1";
const DAILY_DAYS = [0, 1, 2, 3, 4, 5, 6];
const mkRoutine = (title, subtasks = [], days = DAILY_DAYS) => ({
  id: uid(),
  title,
  type: "routine",
  daysOfWeek: days,
  subtasks,
  completed: false,
  history: [],
});
const mkSub = (title, subtasks = []) => ({
  id: uid(),
  title,
  type: "routine",
  subtasks,
  completed: false,
  history: [],
});

const MOBILITY_V1 = mkRoutine("Mobility", [
  mkSub("Diaphragmatic breathing"),
  mkSub("Glute bridges"),
  mkSub("Dead bugs"),
  mkSub("Seiza sitting"),
  mkSub("Seiza sitting 2"),
  mkSub("Cat cows"),
  mkSub("Bird dog"),
  mkSub("Plank"),
  mkSub("Side plank"),
  mkSub("Hip flexor"),
  mkSub("Frog pose"),
  mkSub("Frog pose 2"),
  mkSub("90/90"),
  mkSub("Hip airplane"),
  mkSub("Soleus calf raises"),
  mkSub("Pan cakes"),
  mkSub("Sumo squat"),
  mkSub("Tibialis posterior"),
  mkSub("Tibialis anterior"),
  mkSub("Slow walk"),
]);

const WORKOUT_V1 = mkRoutine("Workout", [
  mkSub("Shoulder warm-up"),
  mkSub("Rotator cuff"),
  mkSub("Lunges"),
  mkSub("Wrist"),
  mkSub("Forearms"),
  mkSub("Face pull"),
  mkSub("Deadlift"),
  mkSub("Lower traps"),
  mkSub("Lats"),
  mkSub("Step squat"),
  mkSub("Pecs"),
  mkSub("Pistol squat"),
  mkSub("Delts"),
  mkSub("Cossack squat"),
  mkSub("Biceps"),
  mkSub("Triceps"),
  mkSub("Calf raises"),
  mkSub("Horse squat"),
  mkSub("Hamstrings"),
  mkSub("Pogo"),
  mkSub("Push up"),
]);

const WORKOUTS_V2 = [MOBILITY_V1, WORKOUT_V1];

const DEFAULT_ROUTINES = [
  mkRoutine("Wake up early"),
  mkRoutine("Have a healthy breakfast"),
  mkRoutine("Practice French", [
    mkSub("Review"),
    mkSub("Lesson"),
    mkSub("Book"),
    mkSub("Song"),
    mkSub("Introduction"),
    mkSub("Watch TV"),
  ]),
  mkRoutine("Have a healthy lunch"),
  mkRoutine("Study chess", [
    mkSub("10 puzzles"),
    mkSub("Game + analysis"),
    mkSub("Vision"),
    mkSub("Video"),
    mkSub("Book"),
  ]),
  mkRoutine("Study STEM", [
    mkSub("Brilliant"),
    mkSub("Susskind Classical Mechanics"),
  ]),
  mkRoutine("Work on thesis"),
  mkRoutine("Have a healthy dinner"),
  mkRoutine("Bed time Routine", [
    mkSub("Cleaning"),
    mkSub("Infusion"),
    mkSub("Massage"),
    mkSub("Read"),
  ]),
  mkRoutine("Walking", [
    mkSub("Tapis roulant"),
    mkSub("Outside"),
  ]),
  mkRoutine("Chores", [
    mkSub("Grocery"),
    mkSub("Laundry"),
    mkSub("Dusting"),
    mkSub("Mopping"),
    mkSub("Dishes"),
    mkSub("Garbage"),
    mkSub("Tidy up"),
    mkSub("Bathroom"),
  ]),
  ...WORKOUTS_V2,
  mkRoutine("Don't Do - Do", [
    mkSub("Don't extend Instagram time limit"),
    mkSub("Don't smoke"),
    mkSub("Call people"),
    mkSub("Don't play chess"),
  ]),
];

const DAILY_HABITS = [
  "Wake up early",
  "Have a healthy breakfast",
  "Practice French",
  "Have a healthy lunch",
  "Study chess",
  "Study STEM",
  "Work on thesis",
  "Have a healthy dinner",
  "Bed time Routine",
];

const HABIT_DETAILS_V1 = {
  "Practice French": [
    "Review",
    "Lesson",
    "Book",
    "Song",
    "Introduction",
  ],
  "Study chess": [
    "10 puzzles",
    "Game + analysis",
    "Vision",
    "Pawn structure",
  ],
};

const ensureHabits = (state) => {
  if (!state || !Array.isArray(state.tasks)) return state;
  if (state.meta && state.meta.habitsV1) return state;
  const existing = new Set(state.tasks.map((t) => t.title));
  const additions = DAILY_HABITS.filter((t) => !existing.has(t)).map((t) =>
    mkRoutine(t)
  );
  return {
    ...state,
    tasks: [...state.tasks, ...additions],
    meta: { ...(state.meta || {}), habitsV1: true },
  };
};

const ensureHabitDetails = (state) => {
  if (!state || !Array.isArray(state.tasks)) return state;
  if (state.meta && state.meta.habitsV2) return state;

  const renameMap = new Map([["Practice Babbel", "Practice French"]]);

  const nextTasks = state.tasks.map((t) => {
    const title = renameMap.get(t.title) || t.title;
    const details = HABIT_DETAILS_V1[title];
    if (!details) return { ...t, title };
    const subs = details.map((s) => mkSub(s));
    return { ...t, title, subtasks: subs };
  });

  return {
    ...state,
    tasks: nextTasks,
    meta: { ...(state.meta || {}), habitsV2: true },
  };
};

const ensureWorkouts = (state) => {
  if (!state || !Array.isArray(state.tasks)) return state;
  if (state.meta?.workoutPlanV3) return state;

  const replaceTitles = new Set([
    "Workout A (Mon) — Feet & calves",
    "Workout B (Tue) — Legs I",
    "Workout C (Thu) — Legs II + upper prep",
    "Workout D (Sat) — Upper + abs",
    "Sport (Full routine)",
    "Mobility",
    "Workout",
  ]);

  const filtered = state.tasks.filter((t) => !replaceTitles.has(t.title));

  return {
    ...state,
    tasks: [...filtered, ...WORKOUTS_V2],
    meta: { ...(state.meta || {}), workoutPlanV2: true, workoutPlanV3: true },
  };
};

const ensureHabitsV3 = (state) => {
  if (!state || !Array.isArray(state.tasks)) return state;
  if (state.meta?.habitsV3) return state;
  const existing = new Set(state.tasks.map((t) => t.title));
  const additions = ["Walking", "Chores"]
    .filter((t) => !existing.has(t))
    .map((t) => mkRoutine(t));
  return {
    ...state,
    tasks: [...state.tasks, ...additions],
    meta: { ...(state.meta || {}), habitsV3: true },
  };
};

const ensureMobilityV2 = (state) => {
  if (!state || !Array.isArray(state.tasks)) return state;
  if (state.meta?.mobilityV2) return state;
  const nextTasks = state.tasks.map((t) => {
    if (t.title !== "Mobility") return t;
    const subs = t.subtasks.map((s) =>
      s.title === "Sumo squat" ? { ...s, title: "Horse squat" } : s
    );
    const pancakeIdx = subs.findIndex((s) => s.title === "Pan cakes");
    if (pancakeIdx >= 0) {
      subs.splice(pancakeIdx + 1, 0, mkSub("Sumo squat"));
    }
    return { ...t, subtasks: subs };
  });
  return { ...state, tasks: nextTasks, meta: { ...(state.meta || {}), mobilityV2: true } };
};

const PAPER_REVISION_TASKS_V1 = [
  {
    id: uid(),
    title: "Run QM water shell test",
    type: "onetime",
    eisenhower: "UI",
    deadline: "2026-04-09",
    subtasks: [
      { id: uid(), title: "Select representative snapshots", type: "onetime", subtasks: [], completed: false },
      { id: uid(), title: "Run palmatine + QM water calculations", type: "onetime", subtasks: [], completed: false },
      { id: uid(), title: "Compare CT character vs electrostatic embedding", type: "onetime", subtasks: [], completed: false },
    ],
    completed: false,
  },
  {
    id: uid(),
    title: "Add QM/MM boundary description to manuscript",
    type: "onetime",
    eisenhower: "UI",
    deadline: "2026-04-05",
    subtasks: [
      { id: uid(), title: "Describe link atom placement (sugar-nucleobase bond)", type: "onetime", subtasks: [], completed: false },
    ],
    completed: false,
  },
  {
    id: uid(),
    title: "Describe snapshot selection procedure",
    type: "onetime",
    eisenhower: "UI",
    deadline: "2026-04-05",
    subtasks: [
      { id: uid(), title: "Justify statistical independence (autocorrelation / stride)", type: "onetime", subtasks: [], completed: false },
    ],
    completed: false,
  },
  {
    id: uid(),
    title: "Add NTOs for S3 and S4 to SI",
    type: "onetime",
    eisenhower: "NUI",
    deadline: "2026-04-09",
    subtasks: [
      { id: uid(), title: "Generate NTO plots for S3 and S4 (AGTC and AATT)", type: "onetime", subtasks: [], completed: false },
      { id: uid(), title: "Add figures to SI and reference from main text", type: "onetime", subtasks: [], completed: false },
    ],
    completed: false,
  },
];

const ensureRoutinesV4 = (state) => {
  if (!state || !Array.isArray(state.tasks)) return state;
  if (state.meta?.routinesV4) return state;

  const toRemoveFromMobility = new Set(["Calf raises", "Horse squat", "Hamstrings"]);

  const nextTasks = state.tasks.map((t) => {
    if (t.title === "Practice French") {
      if ((t.subtasks || []).some((s) => s.title === "Watch TV")) return t;
      return { ...t, subtasks: [...(t.subtasks || []), mkSub("Watch TV")] };
    }
    if (t.title === "Study chess") {
      let subs = (t.subtasks || []).filter((s) => s.title !== "Pawn structure");
      if (!subs.some((s) => s.title === "Video")) subs = [...subs, mkSub("Video")];
      if (!subs.some((s) => s.title === "Book")) subs = [...subs, mkSub("Book")];
      return { ...t, subtasks: subs };
    }
    if (t.title === "Study physics" || t.title === "Study STEM") {
      let subs = [...(t.subtasks || [])];
      if (!subs.some((s) => s.title === "Brilliant")) subs = [...subs, mkSub("Brilliant")];
      if (!subs.some((s) => s.title === "Susskind Classical Mechanics")) subs = [...subs, mkSub("Susskind Classical Mechanics")];
      return { ...t, title: "Study STEM", subtasks: subs };
    }
    if (t.title === "Walking") {
      let subs = [...(t.subtasks || [])];
      if (!subs.some((s) => s.title === "Tapis roulant")) subs = [...subs, mkSub("Tapis roulant")];
      if (!subs.some((s) => s.title === "Outside")) subs = [...subs, mkSub("Outside")];
      return { ...t, subtasks: subs };
    }
    if (t.title === "Chores") {
      const existing = new Set((t.subtasks || []).map((s) => s.title));
      const toAdd = ["Grocery", "Laundry", "Dusting", "Mopping", "Dishes", "Garbage", "Tidy up", "Bathroom"]
        .filter((s) => !existing.has(s))
        .map((s) => mkSub(s));
      return { ...t, subtasks: [...(t.subtasks || []), ...toAdd] };
    }
    if (t.title === "Mobility") {
      return { ...t, subtasks: (t.subtasks || []).filter((s) => !toRemoveFromMobility.has(s.title)) };
    }
    if (t.title === "Workout") {
      const existing = new Set((t.subtasks || []).map((s) => s.title));
      const toAdd = ["Calf raises", "Horse squat", "Hamstrings", "Pogo"]
        .filter((s) => !existing.has(s))
        .map((s) => mkSub(s));
      return { ...t, subtasks: [...(t.subtasks || []), ...toAdd] };
    }
    return t;
  });

  const hasDontDo = nextTasks.some((t) => t.title === "Don't Do");
  const finalTasks = hasDontDo
    ? nextTasks
    : [...nextTasks, mkRoutine("Don't Do", [mkSub("Don't extend Instagram time limit")])];

  return {
    ...state,
    tasks: finalTasks,
    meta: { ...(state.meta || {}), routinesV4: true },
  };
};

const ensurePushUpV1 = (state) => {
  if (!state || !Array.isArray(state.tasks)) return state;
  if (state.meta?.pushUpV1) return state;
  const nextTasks = state.tasks.map((t) => {
    if (t.title !== "Workout") return t;
    if ((t.subtasks || []).some((s) => s.title === "Push up")) return t;
    return { ...t, subtasks: [...(t.subtasks || []), mkSub("Push up")] };
  });
  return { ...state, tasks: nextTasks, meta: { ...(state.meta || {}), pushUpV1: true } };
};

const ensureDontPlayChessV1 = (state) => {
  if (!state || !Array.isArray(state.tasks)) return state;
  if (state.meta?.dontPlayChessV1) return state;
  const nextTasks = state.tasks.map((t) => {
    if (t.title !== "Don't Do - Do") return t;
    if ((t.subtasks || []).some((s) => s.title === "Don't play chess")) return t;
    return { ...t, subtasks: [...(t.subtasks || []), mkSub("Don't play chess")] };
  });
  return { ...state, tasks: nextTasks, meta: { ...(state.meta || {}), dontPlayChessV1: true } };
};

const ensureBedtimeRoutineV1 = (state) => {
  if (!state || !Array.isArray(state.tasks)) return state;
  if (state.meta?.bedtimeRoutineV1) return state;
  const nextTasks = state.tasks.map((t) => {
    if (t.title !== "Read before bed" && t.title !== "Bed time Routine") return t;
    let subs = [...(t.subtasks || [])];
    if (!subs.some((s) => s.title === "Cleaning")) subs = [...subs, mkSub("Cleaning")];
    if (!subs.some((s) => s.title === "Infusion")) subs = [...subs, mkSub("Infusion")];
    if (!subs.some((s) => s.title === "Massage")) subs = [...subs, mkSub("Massage")];
    if (!subs.some((s) => s.title === "Read")) subs = [...subs, mkSub("Read")];
    return { ...t, title: "Bed time Routine", subtasks: subs };
  });
  return { ...state, tasks: nextTasks, meta: { ...(state.meta || {}), bedtimeRoutineV1: true } };
};

const ensureDontDoV2 = (state) => {
  if (!state || !Array.isArray(state.tasks)) return state;
  if (state.meta?.dontDoV2) return state;
  const nextTasks = state.tasks.map((t) => {
    if (t.title !== "Don't Do" && t.title !== "Don't Do - Do") return t;
    let subs = [...(t.subtasks || [])];
    if (!subs.some((s) => s.title === "Don't smoke")) subs = [...subs, mkSub("Don't smoke")];
    if (!subs.some((s) => s.title === "Call people")) subs = [...subs, mkSub("Call people")];
    return { ...t, title: "Don't Do - Do", subtasks: subs };
  });
  return { ...state, tasks: nextTasks, meta: { ...(state.meta || {}), dontDoV2: true } };
};

const ensureWorkoutPogoV1 = (state) => {
  if (!state || !Array.isArray(state.tasks)) return state;
  if (state.meta?.workoutPogoV1) return state;
  const nextTasks = state.tasks.map((t) => {
    if (t.title !== "Workout") return t;
    if ((t.subtasks || []).some((s) => s.title === "Pogo")) return t;
    return { ...t, subtasks: [...(t.subtasks || []), mkSub("Pogo")] };
  });
  return { ...state, tasks: nextTasks, meta: { ...(state.meta || {}), workoutPogoV1: true } };
};

const ensurePaperRevisionV1 = (state) => {
  if (!state || !Array.isArray(state.tasks)) return state;
  if (state.meta?.paperRevisionV1) return state;
  const existing = new Set(state.tasks.map((t) => t.title));
  const additions = PAPER_REVISION_TASKS_V1.filter((t) => !existing.has(t.title));
  return {
    ...state,
    tasks: [...state.tasks, ...additions],
    meta: { ...(state.meta || {}), paperRevisionV1: true },
  };
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return ensurePushUpV1(ensureDontPlayChessV1(ensureBedtimeRoutineV1(ensureDontDoV2(ensureWorkoutPogoV1(ensureRoutinesV4(ensurePaperRevisionV1(ensureMobilityV2(ensureHabitsV3(ensureHabitDetails(ensureHabits(ensureWorkouts(JSON.parse(raw)))))))))))));
    return {
      tasks: DEFAULT_ROUTINES,
      theme: "light",
      meta: { workoutPlanV2: true, workoutPlanV3: true, habitsV1: true, habitsV2: true, habitsV3: true, mobilityV2: true },
    };
  } catch {
    return {
      tasks: DEFAULT_ROUTINES,
      theme: "light",
      meta: { workoutPlanV2: true, workoutPlanV3: true, habitsV1: true, habitsV2: true, habitsV3: true, mobilityV2: true },
    };
  }
};

// Priority labels/colors
const E_LABELS = {
  UI: "Urgent & Important",
  UNI: "Urgent & Not Important",
  NUI: "Not Urgent & Important",
  NUNI: "Not Urgent & Not Important",
};
const E_COLORS = {
  UI: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-700",
  UNI: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700",
  NUI: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-700",
  NUNI:
    "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
};

// --- Helpers ---
const flattenSubtasks = (task) => {
  const out = [];
  const walk = (t) => {
    (t.subtasks || []).forEach((st) => {
      out.push(st);
      walk(st);
    });
  };
  walk(task);
  return out;
};

// returns null if no subtasks; otherwise % of subtasks done for date
const percentForDate = (task, date) => {
  if (task.type !== "routine") return null;
  const list = flattenSubtasks(task);
  if (list.length === 0) return null;
  const done = list.filter((st) => {
    const h = (st.history || []).find((x) => x.date === date);
    return h && h.completed;
  }).length;
  return Math.round((done / list.length) * 100);
};

const removeTaskById = (tasks, id) =>
  tasks
    .filter((t) => t.id !== id)
    .map((t) => ({ ...t, subtasks: removeTaskById(t.subtasks || [], id) }));

const weekStartISO = () => toLocalISO(startOfWeek(new Date()));

// --- App ---
export default function App() {
  const [state, setState] = useState(loadState());
  const [route, setRoute] = useState({
    page: "todo", // 'todo' | 'calendar'
    sub: "routine", // 'routine' | 'onetime'
    view: "month", // 'month' | 'week' | 'day'
  });
  const [showModal, setShowModal] = useState(false);
  const skipNextSave = useRef(false);

  // dark toggle
  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.theme === "dark");
  }, [state.theme]);

  // persist locally + sync to Firestore (debounced)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setDoc(plannerDoc, { state: JSON.stringify(state) }).catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  // weekly cleanup: delete completed one-time tasks once per week
  useEffect(() => {
    const currentWeek = weekStartISO();
    setState((s) => {
      if (s.meta?.weeklyCleanup === currentWeek) return s;
      return {
        ...s,
        tasks: s.tasks.filter((t) => !(t.type === "onetime" && t.completed)),
        meta: { ...(s.meta || {}), weeklyCleanup: currentWeek },
      };
    });
  }, []);

  // listen for changes from other devices
  useEffect(() => {
    const unsub = onSnapshot(plannerDoc, (snap) => {
      if (!snap.exists()) return;
      const json = snap.data()?.state;
      if (!json) return;
      try {
        const parsed = JSON.parse(json);
        if (parsed) {
          const migrated = ensurePushUpV1(ensureDontPlayChessV1(ensureBedtimeRoutineV1(ensureDontDoV2(ensureWorkoutPogoV1(ensureRoutinesV4(ensurePaperRevisionV1(ensureMobilityV2(ensureHabitsV3(ensureHabitDetails(ensureHabits(ensureWorkouts(parsed))))))))))));
          skipNextSave.current = true;
          setState(migrated);
        }
      } catch {}
    });
    return () => unsub();
  }, []);

  const addTask = (payload) =>
    setState((s) => ({ ...s, tasks: [...s.tasks, payload] }));

  const updateTask = (id, updater) => {
    const recur = (arr) =>
      arr.map((t) => {
        if (t.id === id) return updater({ ...t });
        return { ...t, subtasks: recur(t.subtasks || []) };
      });
    setState((s) => ({ ...s, tasks: recur(s.tasks) }));
  };

  const addSubtask = (parentId, st) =>
    updateTask(parentId, (t) => ({ ...t, subtasks: [...(t.subtasks || []), st] }));

  const deleteTask = (id) =>
    setState((s) => ({ ...s, tasks: removeTaskById(s.tasks, id) }));

  const moveTaskInList = (orderedIds, id, dir) =>
    setState((s) => {
      const idx = orderedIds.indexOf(id);
      if (idx < 0) return s;
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= orderedIds.length) return s;

      const newOrder = [...orderedIds];
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

      const groupSet = new Set(orderedIds);
      const groupMap = new Map(
        s.tasks.filter((t) => groupSet.has(t.id)).map((t) => [t.id, t])
      );
      const newGroupList = newOrder.map((tid) => groupMap.get(tid)).filter(Boolean);
      let gi = 0;

      const nextTasks = s.tasks.map((t) =>
        groupSet.has(t.id) ? newGroupList[gi++] : t
      );

      return { ...s, tasks: nextTasks };
    });

  const routineTasks = useMemo(
    () => state.tasks.filter((t) => t.type === "routine"),
    [state.tasks]
  );
  const onetimeTasks = useMemo(
    () => state.tasks.filter((t) => t.type === "onetime"),
    [state.tasks]
  );

  return (
    <div className="min-h-screen font-sans bg-gradient-to-br from-neutral-50 via-white to-slate-50 text-neutral-900 dark:from-neutral-900 dark:via-neutral-950 dark:to-black dark:text-neutral-100">
      <header className="sticky top-0 z-10 bg-white/70 dark:bg-black/40 backdrop-blur border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-6xl mx-auto flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xl font-semibold">Personal Planner</span>
            <nav className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  setRoute({ page: "todo", sub: route.sub, view: route.view })
                }
                className={`px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm rounded-2xl border flex items-center gap-2 transition ${
                  route.page === "todo"
                    ? "bg-neutral-900 text-white border-neutral-900 shadow dark:bg-white dark:text-black dark:border-white"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <ListTodo className="w-4 h-4" /> To-Do
              </button>
              <button
                onClick={() =>
                  setRoute({ page: "calendar", sub: route.sub, view: route.view })
                }
                className={`px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm rounded-2xl border flex items-center gap-2 transition ${
                  route.page === "calendar"
                    ? "bg-neutral-900 text-white border-neutral-900 shadow dark:bg-white dark:text-black dark:border-white"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <CalendarIcon className="w-4 h-4" /> Calendar
              </button>
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="hidden sm:flex px-3 py-1.5 rounded-2xl border text-sm items-center gap-2 transition bg-neutral-900 text-white dark:bg-white dark:text-black"
            >
              <Plus className="w-4 h-4" /> Add Task
            </button>

            <button
              onClick={() =>
                setRoute({ page: route.page, sub: "routine", view: route.view })
              }
              className={`px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm rounded-2xl border transition ${
                route.sub === "routine"
                  ? "bg-neutral-200 dark:bg-neutral-800"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              Routine
            </button>
            <button
              onClick={() =>
                setRoute({ page: route.page, sub: "onetime", view: route.view })
              }
              className={`px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm rounded-2xl border transition ${
                route.sub === "onetime"
                  ? "bg-neutral-200 dark:bg-neutral-800"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              One-time
            </button>

            {route.page === "calendar" && (
              <div className="ml-0 sm:ml-2 flex items-center gap-1">
                <button
                  onClick={() => setRoute((r) => ({ ...r, view: "month" }))}
                  className={`p-2 rounded-xl border ${
                    route.view === "month" ? "bg-neutral-200 dark:bg-neutral-800" : ""
                  }`}
                  title="Month"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRoute((r) => ({ ...r, view: "week" }))}
                  className={`p-2 rounded-xl border ${
                    route.view === "week" ? "bg-neutral-200 dark:bg-neutral-800" : ""
                  }`}
                  title="Week"
                >
                  <CalendarRange className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRoute((r) => ({ ...r, view: "day" }))}
                  className={`p-2 rounded-xl border ${
                    route.view === "day" ? "bg-neutral-200 dark:bg-neutral-800" : ""
                  }`}
                  title="Day"
                >
                  <CalendarDays className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-3 sm:p-4">
        {route.page === "todo" ? (
          route.sub === "routine" ? (
            <RoutineTodo
              tasks={routineTasks}
              addSubtask={addSubtask}
              updateTask={updateTask}
              deleteTask={deleteTask}
              moveTaskInList={moveTaskInList}
            />
          ) : (
            <OneTimeTodo
              tasks={onetimeTasks}
              addSubtask={addSubtask}
              updateTask={updateTask}
              deleteTask={deleteTask}
              moveTaskInList={moveTaskInList}
            />
          )
        ) : route.sub === "routine" ? (
          <RoutineCalendar tasks={routineTasks} view={route.view} />
        ) : (
          <OneTimeCalendar tasks={onetimeTasks} view={route.view} />
        )}
      </main>

      {showModal && (
        <AddTaskModal
          onClose={() => setShowModal(false)}
          onCreate={(t) => {
            addTask(t);
            setShowModal(false);
          }}
        />
      )}

    </div>
  );
}

/* ================== Add Task Modal ================== */
function AddTaskModal({ onClose, onCreate }) {
  const [type, setType] = useState("routine"); // 'routine' | 'onetime'
  const [title, setTitle] = useState("");
  const [days, setDays] = useState([new Date().getDay()]);
  const [prio, setPrio] = useState("UI");
  const [deadline, setDeadline] = useState(todayISO());
  const [subTxt, setSubTxt] = useState("");
  const [subs, setSubs] = useState([]);

  const toggleDay = (d) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const addSub = () => {
    const val = subTxt.trim();
    if (!val) return;
    setSubs((s) => {
      if (s.length && s[s.length - 1].title === val) return s; // double-click guard
      return [...s, { id: uid(), title: val, type, subtasks: [], completed: false, history: [] }];
    });
    setSubTxt("");
  };
  const removeSub = (id) => setSubs((s) => s.filter((x) => x.id !== id));

  const applyTypeRecursive = (node, t) => ({
    ...node,
    type: t,
    subtasks: (node.subtasks || []).map((st) => applyTypeRecursive(st, t)),
  });

  const submit = () => {
    if (!title.trim()) return;
    if (type === "routine") {
      onCreate({
        id: uid(),
        title: title.trim(),
        type: "routine",
        daysOfWeek: [...days].sort(),
        subtasks: subs.map((s) => applyTypeRecursive(s, "routine")),
        completed: false,
        history: [],
      });
    } else {
      onCreate({
        id: uid(),
        title: title.trim(),
        type: "onetime",
        eisenhower: prio,
        deadline: deadline || todayISO(),
        subtasks: subs.map((s) => applyTypeRecursive(s, "onetime")),
        completed: false,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl border bg-white dark:bg-neutral-900 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b dark:border-neutral-800">
          <div>
            <h3 className="text-lg font-semibold">Add New Task</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Create a new routine or prioritized task
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Task Type */}
          <div>
            <label className="text-sm">Task Type</label>
            <div className="mt-1">
              <select
                className="w-full border rounded-xl px-3 py-2 bg-white dark:bg-neutral-950"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="routine">Routine Task</option>
                <option value="onetime">One-time Task</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm">Task Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Reading 20 min"
              className="w-full border rounded-xl px-3 py-2 bg-white dark:bg-neutral-950"
            />
          </div>

          {/* Routine: days picker */}
          {type === "routine" && (
            <div>
              <label className="text-sm">Days of Week</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {dayLabels.map((lbl, idx) => (
                  <button
                    key={lbl}
                    onClick={() => toggleDay(idx)}
                    className={`px-3 py-1.5 rounded-full border ${
                      days.includes(idx)
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
                        : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* One-time: priority + deadline */}
          {type === "onetime" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm">Priority</label>
                <select
                  value={prio}
                  onChange={(e) => setPrio(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 bg-white dark:bg-neutral-950"
                >
                  {Object.entries(E_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm">Deadline *</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 bg-white dark:bg-neutral-950"
                />
              </div>
            </div>
          )}

          {/* Subtasks collector */}
          <div>
            <label className="text-sm">Subtasks (Optional)</label>
            <div className="mt-1 flex gap-2">
              <input
                value={subTxt}
                onChange={(e) => setSubTxt(e.target.value)}
                placeholder="Add a subtask..."
                className="grow border rounded-xl px-3 py-2 bg-white dark:bg-neutral-950"
              />
              <button type="button" onClick={addSub} className="px-3 py-2 rounded-xl border">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {subs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {subs.map((s) => (
                  <span key={s.id} className="text-sm inline-flex items-center gap-1 px-2 py-1 rounded-full border">
                    {s.title}
                    <button
                      onClick={() => removeSub(s.id)}
                      className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 flex items-center justify-end gap-2 border-t dark:border-neutral-800">
          <button onClick={onClose} className="px-3 py-2 rounded-xl border">
            Cancel
          </button>
          <button onClick={submit} className="px-3 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-black">
            Add Task
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================== To-Do ================== */

function RoutineTodo({ tasks, addSubtask, updateTask, deleteTask, moveTaskInList }) {
  const today = new Date().getDay();
  const selectedISO = todayISO();

  const filtered = useMemo(
    () => tasks.filter((t) => (t.daysOfWeek || []).includes(today)),
    [tasks, today]
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Layers className="w-5 h-5" /> Routine Tasks
      </h2>

      <TaskList
        tasks={filtered}
        selectedISO={selectedISO}
        addSubtask={addSubtask}
        updateTask={updateTask}
        deleteTask={deleteTask}
        onMove={(id, dir) => moveTaskInList(filtered.map((t) => t.id), id, dir)}
      />

      {filtered.length === 0 && (
        <div className="rounded-2xl border p-6 text-center text-neutral-500 dark:text-neutral-400">
          No routines scheduled for today.
        </div>
      )}
    </div>
  );
}

function OneTimeTodo({ tasks, addSubtask, updateTask, deleteTask, moveTaskInList }) {
  const grouped = useMemo(
    () => ({
      UI: tasks.filter((t) => t.eisenhower === "UI"),
      UNI: tasks.filter((t) => t.eisenhower === "UNI"),
      NUI: tasks.filter((t) => t.eisenhower === "NUI"),
      NUNI: tasks.filter((t) => t.eisenhower === "NUNI"),
    }),
    [tasks]
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <CheckSquare className="w-5 h-5" /> One-time Tasks
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(grouped).map(([key, list]) => (
          <div
            key={key}
            className="border rounded-2xl bg-white/90 dark:bg-neutral-900 shadow-md hover:shadow-lg transition"
          >
            <div className="p-3 font-medium border-b dark:border-neutral-800">
              {E_LABELS[key]}
            </div>
            <TaskList
              tasks={list}
              addSubtask={addSubtask}
              updateTask={updateTask}
              deleteTask={deleteTask}
              onMove={(id, dir) => moveTaskInList(list.map((t) => t.id), id, dir)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskList({
  tasks,
  addSubtask,
  updateTask,
  deleteTask,
  onMove,
  selectedISO = todayISO(),
}) {
  if (!tasks.length)
    return <div className="p-4 text-sm text-neutral-500">No tasks yet.</div>;
  return (
    <ul className="divide-y dark:divide-neutral-800">
      {tasks.map((t, idx) => (
        <TaskRow
          key={t.id}
          task={t}
          addSubtask={addSubtask}
          updateTask={updateTask}
          deleteTask={deleteTask}
          selectedISO={selectedISO}
          canMoveUp={idx > 0}
          canMoveDown={idx < tasks.length - 1}
          onMove={(dir) => onMove && onMove(t.id, dir)}
        />
      ))}
    </ul>
  );
}

function TaskRow({
  task,
  addSubtask,
  updateTask,
  deleteTask,
  selectedISO,
  canMoveUp = false,
  canMoveDown = false,
  onMove,
}) {
  const [open, setOpen] = useState(false); // collapsed by default
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(task.title);

  // ✅ Immutable toggle for routine parent (writes history for selected day)
  //    and for one-time parent (simple boolean).
  const toggleComplete = () => {
    if (task.type === "routine") {
      updateTask(task.id, (t) => {
        const history = t.history ? [...t.history] : [];
        const i = history.findIndex((h) => h.date === selectedISO);
        const newHistory =
          i >= 0
            ? history.map((h, idx) =>
                idx === i ? { ...h, completed: !h.completed } : h
              )
            : [...history, { date: selectedISO, completed: true }];
        return { ...t, history: newHistory };
      });
    } else {
      updateTask(task.id, (t) => ({ ...t, completed: !t.completed }));
    }
  };

  const addChild = (txt) => {
    if (!txt) return;
    addSubtask(task.id, {
      id: uid(),
      title: txt,
      type: task.type,
      subtasks: [],
      completed: false,
      history: [],
    });
  };

  const checked =
    task.type === "routine"
      ? !!(task.history || []).find((h) => h.date === selectedISO && h.completed)
      : !!task.completed;

  return (
    <li className="p-2 sm:p-3">
      <div className="flex items-start gap-2 sm:gap-3">
        {(task.subtasks || []).length > 0 ? (
          <button onClick={() => setOpen((o) => !o)} className="mt-1">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="mt-1 w-4 h-4 inline-block" />
        )}
        <input
          type="checkbox"
          className="mt-1 w-4 h-4"
          checked={checked}
          onChange={toggleComplete}
        />
        <div className="grow">
          {edit ? (
            <div className="flex gap-2 items-center">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border rounded-xl px-2 py-1 w-full bg-white dark:bg-neutral-950"
              />
              <button
                className="px-2 py-1 border rounded-xl"
                onClick={() => {
                  updateTask(task.id, (t) => ({ ...t, title }));
                  setEdit(false);
                }}
              >
                Save
              </button>
              <button
                className="px-2 py-1 border rounded-xl"
                onClick={() => {
                  setTitle(task.title);
                  setEdit(false);
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{task.title}</span>
              {task.type === "onetime" && task.deadline && (
                <span className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full border dark:border-neutral-700">
                  <Clock className="w-3 h-3" />
                  {task.deadline}
                </span>
              )}
              {task.type === "onetime" && task.eisenhower && (
                <span
                  className={`text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full border ${E_COLORS[task.eisenhower]}`}
                >
                  {E_LABELS[task.eisenhower]}
                </span>
              )}
            </div>
          )}

          {/* Subtasks */}
          {open && (
            <div className="mt-2 ml-4 sm:ml-6">
              {(task.subtasks || []).length > 0 ? (
                <ul className="space-y-1">
                  {task.subtasks.map((st) => (
                    <SubtaskRow
                      key={st.id}
                      parent={task}
                      task={st}
                      updateTask={updateTask}
                      deleteTask={deleteTask}
                      selectedISO={selectedISO}
                    />
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-neutral-500 dark:text-neutral-400">No subtasks.</div>
              )}
              {adding ? (
                <InlineAdd
                  onAdd={(txt) => {
                    addChild(txt);
                    setAdding(false);
                  }}
                  onCancel={() => setAdding(false)}
                />
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="mt-2 text-sm hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-xl border"
                >
                  <Plus className="w-3 h-3" /> Add subtask
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="hidden sm:flex flex-col">
            <button
              className={`p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                canMoveUp ? "" : "opacity-40 cursor-not-allowed"
              }`}
              onClick={() => canMoveUp && onMove && onMove("up")}
              title="Move up"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              className={`p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                canMoveDown ? "" : "opacity-40 cursor-not-allowed"
              }`}
              onClick={() => canMoveDown && onMove && onMove("down")}
              title="Move down"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>
          <button
            className="hidden sm:inline-flex p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => setEdit(true)}
            title="Edit"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            className="hidden sm:inline-flex p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => deleteTask(task.id)}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

function SubtaskRow({ parent, task, updateTask, deleteTask, selectedISO }) {
  const [open, setOpen] = useState(false); // collapsed by default
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(task.title);

  // ✅ Immutable toggles; base behavior on *parent.type*
  const toggle = () => {
    if (parent.type === "routine") {
      // routine subtasks: flip completion for the selectedISO date
      updateTask(parent.id, (t) => {
        const toggleById = (node) => {
          if (node.id === task.id) {
            const hist = node.history ? [...node.history] : [];
            const i = hist.findIndex((h) => h.date === selectedISO);
            const newHist =
              i >= 0
                ? hist.map((h, idx) =>
                    idx === i ? { ...h, completed: !h.completed } : h
                  )
                : [...hist, { date: selectedISO, completed: true }];
            return { ...node, history: newHist };
          }
          return { ...node, subtasks: (node.subtasks || []).map(toggleById) };
        };
        return toggleById(t);
      });
    } else {
      // one-time subtasks: simple boolean toggle
      updateTask(parent.id, (t) => {
        const toggleById = (node) =>
          node.id === task.id
            ? { ...node, completed: !node.completed }
            : { ...node, subtasks: (node.subtasks || []).map(toggleById) };
        return toggleById(t);
      });
    }
  };

  const addChild = (txt) => {
    if (!txt) return;
    updateTask(parent.id, (t) => {
      const visit = (node) => {
        if (node.id === task.id) {
          return {
            ...node,
            subtasks: [
              ...(node.subtasks || []),
              {
                id: uid(),
                title: txt,
                type: node.type,
                subtasks: [],
                completed: false,
                history: [],
              },
            ],
          };
        }
        return { ...node, subtasks: (node.subtasks || []).map(visit) };
      };
      return visit(t);
    });
  };

  const checked =
    parent.type === "routine"
      ? !!(task.history || []).find((h) => h.date === selectedISO && h.completed)
      : !!task.completed;

  return (
    <li>
      <div className="flex items-start gap-2 sm:gap-3">
        {(task.subtasks || []).length > 0 ? (
          <button onClick={() => setOpen((o) => !o)} className="mt-0.5">
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <span className="mt-0.5 w-3 h-3 inline-block" />
        )}
        <input type="checkbox" className="mt-1 w-4 h-4" checked={checked} onChange={toggle} />
        <div className="grow">
          {edit ? (
            <div className="flex gap-2 items-center">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border rounded-xl px-2 py-1 w-full bg-white dark:bg-neutral-950"
              />
              <button
                className="px-2 py-1 border rounded-xl"
                onClick={() => {
                  updateTask(parent.id, (t) => {
                    const visit = (node) => {
                      if (node.id === task.id) return { ...node, title };
                      return { ...node, subtasks: (node.subtasks || []).map(visit) };
                    };
                    return visit(t);
                  });
                  setEdit(false);
                }}
              >
                Save
              </button>
              <button
                className="px-2 py-1 border rounded-xl"
                onClick={() => {
                  setTitle(task.title);
                  setEdit(false);
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <span className="text-sm">{task.title}</span>
          )}

          {open && (
            <div className="mt-1 ml-4 sm:ml-6">
              {(task.subtasks || []).length > 0 ? (
                <ul className="space-y-1">
                  {task.subtasks.map((st) => (
                    <SubtaskRow
                      key={st.id}
                      parent={parent}
                      task={st}
                      updateTask={updateTask}
                      deleteTask={deleteTask}
                      selectedISO={selectedISO}
                    />
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-neutral-500 dark:text-neutral-400">No subtasks.</div>
              )}
              {adding ? (
                <InlineAdd
                  onAdd={(txt) => {
                    addChild(txt);
                    setAdding(false);
                  }}
                  onCancel={() => setAdding(false)}
                />
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="mt-2 text-xs hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-xl border"
                >
                  <Plus className="w-3 h-3" /> Add subtask
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="hidden sm:inline-flex p-1 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => setEdit(true)}
            title="Edit"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            className="hidden sm:inline-flex p-1 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => deleteTask(task.id)}
            title="Delete subtask"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </li>
  );
}

function InlineAdd({ onAdd, onCancel }) {
  const [txt, setTxt] = useState("");
  return (
    <div className="flex gap-2 mt-2">
      <input
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        placeholder="Subtask title"
        className="border rounded-xl px-2 py-1 w-full bg-white dark:bg-neutral-950"
      />
      <button className="px-3 py-1 rounded-xl border" onClick={() => onAdd(txt)}>
        Add
      </button>
      <button className="px-3 py-1 rounded-xl border" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

/* ================== Calendars ================== */

function OneTimeCalendar({ tasks, view }) {
  const [ref, setRef] = useState(new Date());
  const monthDays = useMemo(() => buildMonthDays(ref), [ref]);
  const weekDays = useMemo(() => buildWeekDays(ref), [ref]);
  const dayISO = fmtISO(ref);

  const itemsByDate = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (!t.deadline) return;
      (map[t.deadline] ||= []).push(t);
    });
    return map;
  }, [tasks]);

  const shift = (delta) =>
    setRef((d) =>
      view === "month"
        ? new Date(d.getFullYear(), d.getMonth() + delta, 1)
        : addDays(d, view === "week" ? delta * 7 : delta)
    );

  return (
    <div className="space-y-4">
      <CalHeader
        refDate={ref}
        view={view}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        title="One-time tasks (deadlines & completion)"
      />

      {view === "month" && (
        <MonthGrid
          days={monthDays}
          renderDay={(iso) => {
            const items = itemsByDate[iso] || [];
            if (!items.length) return null;
            const done = items.filter((t) => t.completed).length;
            const allDone = done === items.length;
            return (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                allDone ? "bg-emerald-100 text-emerald-700" :
                done > 0 ? "bg-amber-100 text-amber-700" :
                "bg-neutral-100 text-neutral-500"
              }`}>
                {items.length === 1 ? items[0].title.slice(0, 8) : `${done}/${items.length}`}
              </span>
            );
          }}
        />
      )}

      {view === "week" && (
        <WeekGrid
          days={weekDays}
          renderDay={(iso) => {
            const items = itemsByDate[iso] || [];
            return (
              <div className="space-y-0.5 mt-1">
                {items.map((t) => (
                  <div key={t.id} className="flex items-center gap-1 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.completed ? "bg-emerald-500" : "bg-neutral-300"}`} />
                    <span className={`text-[10px] leading-tight whitespace-nowrap ${t.completed ? "text-neutral-400" : ""}`}>{shortTitle(t.title)}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
      )}

      {view === "day" && (
        <DayCard iso={dayISO} title="Deadlines today">
          {(itemsByDate[dayISO] || []).map((t) => (
            <div key={t.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
              t.completed ? "bg-emerald-50 border-emerald-200" : "bg-white border-neutral-200"
            }`}>
              <span className={`text-sm ${t.completed ? "line-through text-neutral-400" : ""}`}>{t.title}</span>
              {t.completed && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            </div>
          ))}
          {!(itemsByDate[dayISO] || []).length && (
            <div className="text-sm text-neutral-500">No deadlines today.</div>
          )}
        </DayCard>
      )}
    </div>
  );
}

function RoutineCalendar({ tasks, view }) {
  const [ref, setRef] = useState(new Date());
  const monthDays = useMemo(() => buildMonthDays(ref), [ref]);
  const weekDays = useMemo(() => buildWeekDays(ref), [ref]);
  const dayISO = fmtISO(ref);

  const shift = (delta) =>
    setRef((d) =>
      view === "month"
        ? new Date(d.getFullYear(), d.getMonth() + delta, 1)
        : addDays(d, view === "week" ? delta * 7 : delta)
    );

  const getDOW = (iso) => new Date(iso + "T12:00:00").getDay();
  const scheduledFor = (iso) =>
    tasks.filter((t) => (t.daysOfWeek || []).includes(getDOW(iso)));
  const isDone = (t, iso) => {
    const pct = percentForDate(t, iso);
    if (pct !== null) return pct > 0;
    return !!(t.history || []).find((h) => h.date === iso && h.completed);
  };

  // Month: compact "done/total" pill
  const MonthDayRender = (iso) => {
    const scheduled = scheduledFor(iso);
    if (!scheduled.length) return null;
    const done = scheduled.filter((t) => isDone(t, iso)).length;
    const allDone = done === scheduled.length && done > 0;
    const someDone = done > 0 && !allDone;
    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
        allDone ? "bg-emerald-100 text-emerald-700" :
        someDone ? "bg-amber-100 text-amber-700" :
        "text-neutral-400"
      }`}>
        {done}/{scheduled.length}
      </span>
    );
  };

  // Week: dot + short label, all tasks shown
  const WeekDayRender = (iso) => {
    const scheduled = scheduledFor(iso);
    return (
      <div className="space-y-0.5 mt-1">
        {scheduled.map((t) => {
          const done = isDone(t, iso);
          return (
            <div key={t.id} className="flex items-center gap-1 min-w-0">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${done ? "bg-emerald-500" : "bg-neutral-300"}`} />
              <span className={`text-[10px] leading-tight whitespace-nowrap ${done ? "text-neutral-400" : ""}`}>
                {shortTitle(t.title)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Day: full list with % progress
  const DayFullRender = (iso) => {
    const scheduled = scheduledFor(iso);
    return (
      <div className="space-y-2">
        {scheduled.map((t) => {
          const pct = percentForDate(t, iso);
          const done = isDone(t, iso);
          return (
            <div key={t.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
              done ? "bg-emerald-50 border-emerald-200" : "bg-white border-neutral-200"
            }`}>
              <span className={`text-sm ${done && !pct ? "line-through text-neutral-400" : ""}`}>{t.title}</span>
              {pct !== null && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-neutral-50 shrink-0">{pct}%</span>
              )}
            </div>
          );
        })}
        {!scheduled.length && <div className="text-sm text-neutral-500">No routines scheduled.</div>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <CalHeader refDate={ref} view={view} onPrev={() => shift(-1)} onNext={() => shift(1)} title="Routine tasks" />
      {view === "month" && <MonthGrid days={monthDays} renderDay={MonthDayRender} />}
      {view === "week" && <WeekGrid days={weekDays} renderDay={WeekDayRender} />}
      {view === "day" && <DayCard iso={dayISO} title="Routines">{DayFullRender(dayISO)}</DayCard>}
    </div>
  );
}

/* ================== Calendar shells ================== */
function CalHeader({ refDate, view, onPrev, onNext, title }) {
  const label =
    view === "month"
      ? refDate.toLocaleString(undefined, { month: "long", year: "numeric" })
      : view === "week"
      ? `${fmtISO(startOfWeek(refDate))} → ${fmtISO(endOfWeek(refDate))}`
      : fmtISO(refDate);

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-neutral-500 dark:text-neutral-400">{title}</div>
        <h3 className="text-xl font-semibold mt-0.5">{label}</h3>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1 rounded-xl border hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={onPrev}>
          Prev
        </button>
        <button className="px-3 py-1 rounded-xl border hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  );
}

function MonthGrid({ days, renderDay }) {
  return (
    <div className="mt-2">
      <div className="grid grid-cols-7 gap-1">
        {dayLabels.map((d) => (
          <div key={d} className="text-[10px] text-center text-neutral-400 pb-1">
            {d.slice(0, 1)}
          </div>
        ))}
        {days.map(({ iso, inMonth }) => (
          <div
            key={iso}
            className={`min-h-[48px] sm:min-h-[72px] p-1 rounded-xl border bg-white/90 dark:bg-neutral-900 transition ${
              inMonth ? "" : "opacity-30"
            } ${iso === todayISO() ? "border-neutral-400" : ""}`}
          >
            <div
              className={`text-[10px] font-medium inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full mb-0.5 ${
                iso === todayISO()
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              {iso.slice(8, 10)}
            </div>
            {renderDay(iso)}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekGrid({ days, renderDay }) {
  return (
    <div className="mt-2">
      <div className="grid grid-cols-7 gap-1">
        {days.map((iso) => {
          const isToday = iso === todayISO();
          const d = new Date(iso + "T12:00:00");
          return (
            <div
              key={iso}
              className={`p-1 sm:p-2 rounded-xl border bg-white/90 dark:bg-neutral-900 transition ${
                isToday ? "border-neutral-400" : ""
              }`}
            >
              <div className="flex flex-col items-center mb-1">
                <span className="text-[9px] text-neutral-400 uppercase">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className={`text-[10px] sm:text-xs font-semibold inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full ${
                  isToday ? "bg-neutral-900 text-white" : "text-neutral-600 dark:text-neutral-300"
                }`}>
                  {iso.slice(8, 10)}
                </span>
              </div>
              {renderDay(iso)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayCard({ iso, title, children }) {
  const nice = new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="rounded-2xl border bg-white/90 dark:bg-neutral-900 shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400">{title}</div>
          <div className="text-lg font-semibold">{nice}</div>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/* ================== Calendar helpers ================== */
function buildMonthDays(refDate) {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // back to Sunday
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay())); // forward to Saturday
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const copy = new Date(d);
    days.push({ iso: fmtISO(copy), inMonth: copy.getMonth() === m });
  }
  return days;
}

function buildWeekDays(refDate) {
  const start = startOfWeek(refDate);
  const out = [];
  for (let i = 0; i < 7; i++) out.push(fmtISO(addDays(start, i)));
  return out;
}
