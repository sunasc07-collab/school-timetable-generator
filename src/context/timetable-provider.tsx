"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import type { Teacher, Subject, TimetableData, TimetableSession, Conflict, TimeSlot } from "@/lib/types";

type TimetableContextType = {
  teachers: Teacher[];
  addTeacher: (name: string, subjects: Omit<Subject, "id">[]) => void;
  removeTeacher: (id: string) => void;
  updateTeacher: (id: string, name: string, subjects: Subject[]) => void;
  timetable: TimetableData;
  days: string[];
  timeSlots: TimeSlot[];
  generateTimetable: () => Promise<void>;
  moveSession: (session: TimetableSession, from: { day: string, period: number }, to: { day: string, period: number }) => void;
  conflicts: Conflict[];
  isConflict: (sessionId: string) => boolean;
};

const TimetableContext = createContext<TimetableContextType | undefined>(undefined);

const defaultTeachers: Teacher[] = [
    {
        id: "t1",
        name: "Mr. Smith",
        subjects: [
            { id: "s1-1", name: "Mathematics", className: "Grade 9A", periods: 5 },
            { id: "s1-2", name: "Physics", className: "Grade 10B", periods: 4 },
        ],
    },
    {
        id: "t2",
        name: "Ms. Jones",
        subjects: [
            { id: "s2-1", name: "English", className: "Grade 9A", periods: 5 },
            { id: "s2-2", name: "History", className: "Grade 8", periods: 3 },
        ],
    },
    {
        id: "t3",
        name: "Dr. Brown",
        subjects: [
            { id: "s3-1", name: "Chemistry", className: "Grade 10B", periods: 4 },
            { id: "s3-2", name: "Biology", className: "Grade 9A", periods: 4 },
        ],
    },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const TIME_SLOTS: TimeSlot[] = [
  { period: 1, time: "8:00 - 8:40" },
  { period: 2, time: "8:40 - 9:20" },
  { period: 3, time: "9:20 - 10:00" },
  { period: null, time: "10:00 - 10:30", isBreak: true, label: "Short Break" },
  { period: 4, time: "10:30 - 11:10" },
  { period: 5, time: "11:10 - 11:50" },
  { period: 6, time: "11:50 - 12:30" },
  { period: null, time: "12:30 - 1:00", isBreak: true, label: "Lunch Break" },
  { period: 7, time: "1:00 - 1:40" },
  { period: 8, time: "1:40 - 2:20" },
  { period: 9, time: "2:20 - 3:00" },
];
const PERIOD_COUNT = TIME_SLOTS.filter(ts => !ts.isBreak).length;


export function TimetableProvider({ children }: { children: ReactNode }) {
  const [teachers, setTeachers] = useState<Teacher[]>(defaultTeachers);
  const [timetable, setTimetable] = useState<TimetableData>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const days = Object.keys(timetable).length > 0 ? DAYS : [];
  const timeSlots = Object.keys(timetable).length > 0 ? TIME_SLOTS : [];

  const addTeacher = (name: string, subjects: Omit<Subject, "id">[]) => {
    const newTeacher: Teacher = {
      id: crypto.randomUUID(),
      name,
      subjects: subjects.map(s => ({ ...s, id: crypto.randomUUID() })),
    };
    setTeachers((prev) => [...prev, newTeacher]);
  };

  const removeTeacher = (id: string) => {
    setTeachers((prev) => prev.filter((teacher) => teacher.id !== id));
  };
  
  const updateTeacher = (id: string, name: string, subjects: Subject[]) => {
    setTeachers(prev => prev.map(t => t.id === id ? { id, name, subjects } : t));
  };

  const generateLocalTimetable = () => {
    // 1. Create a list of all sessions to be scheduled
    const allSessions: Omit<TimetableSession, 'id'>[] = [];
    teachers.forEach(teacher => {
        teacher.subjects.forEach(subject => {
            for (let i = 0; i < subject.periods; i++) {
                allSessions.push({ teacher: teacher.name, subject: subject.name, className: subject.className });
            }
        });
    });

    // Shuffle sessions to get a different layout each time
    for (let i = allSessions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allSessions[i], allSessions[j]] = [allSessions[j], allSessions[i]];
    }

    // 2. Initialize empty timetable, teacher availability, and class availability grids
    const newTimetable: TimetableData = {};
    const availability: { [day: string]: { [period: number]: { teachers: string[], classes: string[] } } } = {};

    for (const day of DAYS) {
        newTimetable[day] = new Array(PERIOD_COUNT).fill(null);
        availability[day] = {};
        for (let i = 0; i < PERIOD_COUNT; i++) {
            availability[day][i] = { teachers: [], classes: [] };
        }
    }
    
    // 3. Simple greedy scheduling algorithm
    let placedCount = 0;
    for (const session of allSessions) {
        let placed = false;
        // Find a random starting point to vary the schedule
        const randomDayOffset = Math.floor(Math.random() * DAYS.length);
        const randomPeriodOffset = Math.floor(Math.random() * PERIOD_COUNT);

        for (let i = 0; i < DAYS.length; i++) {
            const day = DAYS[(i + randomDayOffset) % DAYS.length];
            for (let j = 0; j < PERIOD_COUNT; j++) {
                const period = (j + randomPeriodOffset) % PERIOD_COUNT;
                
                const slotAvailability = availability[day][period];
                
                // Check if slot is empty for BOTH teacher and class
                if (!slotAvailability.teachers.includes(session.teacher) && !slotAvailability.classes.includes(session.className)) {
                    // Temporarily place a placeholder to reserve the first "teacher" slot if we are only checking for teacher conflicts.
                    // This logic assumes one class can have multiple teachers, but one teacher can only teach one class at a time.
                    // For a more robust system, we check both.
                    const existingSessionInSlot = newTimetable[day][period];

                    // For this simple scheduler, we will just find the next fully empty slot.
                    // A real-world scheduler would need to handle multiple classes/groups.
                    if (!existingSessionInSlot) {
                        newTimetable[day][period] = { ...session, id: crypto.randomUUID() };
                        slotAvailability.teachers.push(session.teacher);
                        slotAvailability.classes.push(session.className);
                        placed = true;
                        placedCount++;
                        break; // Go to next session
                    }
                }
            }
            if (placed) break; // Go to next session
        }
    }
    
    if (placedCount < allSessions.length) {
        throw new Error(`Could not schedule all classes. Only ${placedCount} out of ${allSessions.length} sessions were placed. Please check teacher/class workloads or add more periods.`);
    }

    setTimetable(newTimetable);
  }

  const generateTimetable = async () => {
    return new Promise<void>((resolve, reject) => {
        try {
            generateLocalTimetable();
            resolve();
        } catch(error) {
            reject(error);
        }
    });
  };
  
  const moveSession = (
    session: TimetableSession, 
    from: { day: string; period: number },
    to: { day: string; period: number }
  ) => {
    setTimetable(prev => {
        const newTimetable = JSON.parse(JSON.stringify(prev));

        const targetSession = newTimetable[to.day][to.period];

        // Place dragged session in new slot
        newTimetable[to.day][to.period] = session;

        // If target slot was occupied, move its session to original slot, otherwise clear original slot
        newTimetable[from.day][from.period] = targetSession || null;

        return newTimetable;
    });
  }

  const findConflicts = () => {
    const newConflicts: Conflict[] = [];
    if (Object.keys(timetable).length === 0) {
        setConflicts([]);
        return;
    }
    
    const schedule: { [key: string]: string[] } = {}; // key: "day-period"
    
    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const key = `${day}-${period}`;
            schedule[key] = [];

            const sessionsInSlot: TimetableSession[] = [];
            // This is complex because the timetable is per-teacher in the UI, but flat in the data
            // We need to find all sessions that are in this day/period slot across all teachers
            
            Object.values(timetable).forEach(daySchedule => {
                const session = daySchedule[period];
                if (session) {
                    // We need to find the original day/period for this session to check if it's the current one
                    let sessionFoundInThisSlot = false;
                    for (const d of DAYS) {
                        const p = timetable[d]?.findIndex(s => s?.id === session.id);
                        if (d === day && p === period) {
                            sessionFoundInThisSlot = true;
                            break;
                        }
                    }
                    if(sessionFoundInThisSlot && !sessionsInSlot.some(s => s.id === session.id)) {
                       sessionsInSlot.push(session);
                    }
                }
            })

            // Check for teacher conflicts
            const teachersInSlot: string[] = [];
            sessionsInSlot.forEach(s => {
                if (teachersInSlot.includes(s.teacher)) {
                    // This teacher is double booked, find all sessions for this teacher in this slot and mark them
                    sessionsInSlot.forEach(conflicting => {
                        if (conflicting.teacher === s.teacher) {
                            if (!newConflicts.some(c => c.id === conflicting.id)) {
                                newConflicts.push({ id: conflicting.id, type: "teacher", message: `Teacher ${s.teacher} is double-booked.` });
                            }
                        }
                    });
                } else {
                    teachersInSlot.push(s.teacher);
                }
            });
            
            // Check for class conflicts
            const classesInSlot: string[] = [];
            sessionsInSlot.forEach(s => {
                 if(classesInSlot.includes(s.className)) {
                    sessionsInSlot.forEach(conflicting => {
                        if (conflicting.className === s.className) {
                            if (!newConflicts.some(c => c.id === conflicting.id)) {
                                newConflicts.push({ id: conflicting.id, type: "teacher", message: `Class ${s.className} is double-booked.` });
                            }
                        }
                    });
                 } else {
                    classesInSlot.push(s.className)
                 }
            });
        }
    }


    setConflicts(newConflicts);
  };
  
  useEffect(() => {
    findConflicts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetable]);

  const isConflict = (sessionId: string) => {
    return conflicts.some(c => c.id === sessionId);
  }

  return (
    <TimetableContext.Provider
      value={{
        teachers,
        addTeacher,
        removeTeacher,
        updateTeacher,
        timetable,
        days,
        timeSlots,
        generateTimetable,
        moveSession,
        conflicts,
        isConflict,
      }}
    >
      {children}
    </TimetableContext.Provider>
  );
}

export const useTimetable = (): TimetableContextType => {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error("useTimetable must be used within a TimetableProvider");
  }
  return context;
};
