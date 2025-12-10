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
            { id: "s1-1", name: "Mathematics", periods: 5 },
            { id: "s1-2", name: "Physics", periods: 4 },
        ],
    },
    {
        id: "t2",
        name: "Ms. Jones",
        subjects: [
            { id: "s2-1", name: "English", periods: 5 },
            { id: "s2-2", name: "History", periods: 3 },
        ],
    },
    {
        id: "t3",
        name: "Dr. Brown",
        subjects: [
            { id: "s3-1", name: "Chemistry", periods: 4 },
            { id: "s3-2", name: "Biology", periods: 4 },
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
  { period: 7, time: "12:30 - 1:10" },
  { period: null, time: "1:10 - 1:40", isBreak: true, label: "Lunch Break" },
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
                allSessions.push({ teacher: teacher.name, subject: subject.name });
            }
        });
    });

    // Shuffle sessions to get a different layout each time
    for (let i = allSessions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allSessions[i], allSessions[j]] = [allSessions[j], allSessions[i]];
    }

    // 2. Initialize empty timetable and teacher availability grid
    const newTimetable: TimetableData = {};
    const teacherAvailability: { [day: string]: { [period: number]: string[] } } = {};

    for (const day of DAYS) {
        newTimetable[day] = new Array(PERIOD_COUNT).fill(null);
        teacherAvailability[day] = {};
        for (let i = 0; i < PERIOD_COUNT; i++) {
            teacherAvailability[day][i] = [];
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
                // Check if slot is empty AND teacher is available
                if (!newTimetable[day][period] && !teacherAvailability[day][period]?.includes(session.teacher)) {
                    newTimetable[day][period] = { ...session, id: crypto.randomUUID() };
                    if (!teacherAvailability[day][period]) {
                         teacherAvailability[day][period] = [];
                    }
                    teacherAvailability[day][period].push(session.teacher);
                    placed = true;
                    placedCount++;
                    break; // Go to next session
                }
            }
            if (placed) break; // Go to next session
        }
    }
    
    if (placedCount < allSessions.length) {
        // This is a simple way to alert the user. A more robust solution might show which classes couldn't be placed.
        throw new Error(`Could not schedule all classes. Only ${placedCount} out of ${allSessions.length} sessions were placed. Please check teacher workload or add more periods.`);
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
    
    // Check conflicts after a move operation
    const teacherSchedule: { [key: string]: string[] } = {}; // key: "teacher-day-period"
    const allSessions: TimetableSession[] = Object.values(timetable).flat().filter(Boolean) as TimetableSession[];

    allSessions.forEach(session => {
        let sessionDay: string | undefined;
        let sessionPeriod: number | undefined;
        
        for (const day of DAYS) {
            const periodIndex = timetable[day].findIndex(s => s?.id === session.id);
            if (periodIndex !== -1) {
                sessionDay = day;
                sessionPeriod = periodIndex;
                break;
            }
        }
        
        if (sessionDay !== undefined && sessionPeriod !== undefined) {
             const key = `${session.teacher}-${sessionDay}-${sessionPeriod}`;
             if (!teacherSchedule[key]) {
                 teacherSchedule[key] = [];
             }
             teacherSchedule[key].push(session.id);
        }
    });

    Object.values(teacherSchedule).forEach(sessionIds => {
        if (sessionIds.length > 1) {
            sessionIds.forEach(sessionId => {
                 if (!newConflicts.some(c => c.id === sessionId)) {
                    const conflictingSession = allSessions.find(s => s.id === sessionId);
                    if (conflictingSession) {
                        newConflicts.push({
                            id: sessionId,
                            type: "teacher",
                            message: `Teacher ${conflictingSession.teacher} is double-booked.`,
                        });
                    }
                 }
            });
        }
    });


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

    