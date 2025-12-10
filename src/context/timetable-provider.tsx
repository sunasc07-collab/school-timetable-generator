"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import type { Teacher, Subject, TimetableData, TimetableSession, Conflict, TimeSlot, ClassArm } from "@/lib/types";

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
            { id: "s1-1", name: "Mathematics", classes: [{id: "c1-1-1", name: "Grade 9A", periods: 5}] },
            { id: "s1-2", name: "Physics", classes: [{id: "c1-2-1", name: "Grade 10B", periods: 4}] },
        ],
    },
    {
        id: "t2",
        name: "Ms. Jones",
        subjects: [
            { id: "s2-1", name: "English", classes: [{id: "c2-1-1", name: "Grade 9A", periods: 5 }] },
            { id: "s2-2", name: "History", classes: [{id: "c2-2-1", name: "Grade 8", periods: 3 }] },
        ],
    },
    {
        id: "t3",
        name: "Dr. Brown",
        subjects: [
            { id: "s3-1", name: "Chemistry", classes: [{id: "c3-1-1", name: "Grade 10B", periods: 4 }] },
            { id: "s3-2", name: "Biology", classes: [{id: "c3-2-1", name: "Grade 9A", periods: 4 }] },
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
  { period: null, time: "12:30 - 1:30", isBreak: true, label: "Lunch Break" },
  { period: 7, time: "1:30 - 2:10" },
  { period: 8, time: "2:10 - 2:50" },
  { period: 9, time: "2:50 - 3:30" },
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
      subjects: subjects.map(s => ({ 
          ...s, 
          id: crypto.randomUUID(),
          classes: s.classes.map(c => ({...c, id: crypto.randomUUID()}))
      })),
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
    const allSessions: Omit<TimetableSession, 'id'>[] = [];
    teachers.forEach(teacher => {
        teacher.subjects.forEach(subject => {
            subject.classes.forEach(classArm => {
                for (let i = 0; i < classArm.periods; i++) {
                    allSessions.push({ teacher: teacher.name, subject: subject.name, className: classArm.name });
                }
            });
        });
    });

    for (let i = allSessions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allSessions[i], allSessions[j]] = [allSessions[j], allSessions[i]];
    }

    const newTimetable: TimetableData = {};
    const teacherAvailability: { [day: string]: { [period: number]: string[] } } = {};
    const classAvailability: { [day: string]: { [period: number]: string[] } } = {};

    for (const day of DAYS) {
        newTimetable[day] = new Array(PERIOD_COUNT).fill(null);
        teacherAvailability[day] = {};
        classAvailability[day] = {};
        for (let i = 0; i < PERIOD_COUNT; i++) {
            teacherAvailability[day][i] = [];
            classAvailability[day][i] = [];
        }
    }
    
    let placedCount = 0;
    for (const session of allSessions) {
        let placed = false;
        const randomDayOffset = Math.floor(Math.random() * DAYS.length);
        const randomPeriodOffset = Math.floor(Math.random() * PERIOD_COUNT);

        for (let i = 0; i < DAYS.length; i++) {
            const day = DAYS[(i + randomDayOffset) % DAYS.length];
            for (let j = 0; j < PERIOD_COUNT; j++) {
                const period = (j + randomPeriodOffset) % PERIOD_COUNT;
                
                const isTeacherBusy = teacherAvailability[day][period].includes(session.teacher);
                const isClassBusy = classAvailability[day][period].includes(session.className);

                if (!newTimetable[day][period] && !isTeacherBusy && !isClassBusy) {
                    const sessionWithId = { ...session, id: crypto.randomUUID() };
                    
                    let targetPeriod = -1;
                    // This logic is flawed. The newTimetable is not structured per teacher.
                    // Let's try to place it in the general timetable.
                    if (newTimetable[day][period] === null) {
                         newTimetable[day][period] = sessionWithId;
                         teacherAvailability[day][period].push(session.teacher);
                         classAvailability[day][period].push(session.className);
                         placed = true;
                         placedCount++;
                         break;
                    }
                }
            }
            if (placed) break; 
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
        
        const sourceCell = newTimetable[from.day][from.period];
        const targetCell = newTimetable[to.day][to.period];

        if (sourceCell && sourceCell.id !== session.id) {
           // This case can happen if the UI state is out of sync, let's just find the session
           let found = false;
            for(const day of DAYS) {
                for(let p = 0; p < PERIOD_COUNT; p++) {
                    if (newTimetable[day][p] && newTimetable[day][p].id === session.id) {
                        from.day = day;
                        from.period = p;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        }


        // Simple swap
        newTimetable[from.day][from.period] = targetCell;
        newTimetable[to.day][to.period] = session;

        return newTimetable;
    });
  }

 const findConflicts = () => {
    const newConflicts: Conflict[] = [];
    if (Object.keys(timetable).length === 0) {
        setConflicts([]);
        return;
    }

    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const sessionsInSlot: TimetableSession[] = [];

            // The data model `timetable` has sessions for all teachers in one flat structure.
            // So we need to find which sessions fall into this day/period slot.
            // The current data structure is `timetable[day][period]`, which is one session.
            // This structure does not allow for multiple sessions in one slot, so conflicts are inherent in the data structure
            // Let's re-evaluate how to find conflicts.
            // The main conflict is a teacher or a class being in two places at once.
            // Since the grid shows per-teacher view, we need to check across teachers.

            const teacherBookings: { [teacher: string]: TimetableSession[] } = {};
            const classBookings: { [className: string]: TimetableSession[] } = {};

            // Go through the entire timetable to find sessions in this specific slot
            for (const d of DAYS) {
                if (d !== day) continue;
                for (let p = 0; p < PERIOD_COUNT; p++) {
                    if (p !== period) continue;
                    const session = timetable[d]?.[p];
                    if (session) {
                        // This logic is wrong, it should be collecting all sessions in the same slot.
                        // The timetable is not per-teacher, it is global.
                    }
                }
            }
            
            // Let's scan the whole timetable for each day and period
             const allSessionsInSlot = Object.values(timetable)
                .map(daySchedule => daySchedule[period])
                .filter(session => session !== null) as TimetableSession[];

             const teacherCounts: { [teacherName: string]: string[] } = {};
             const classCounts: { [className: string]: string[] } = {};

             for (const currentDay of DAYS) {
                 for (let currentPeriod = 0; currentPeriod < PERIOD_COUNT; currentPeriod++) {
                     const session = timetable[currentDay]?.[currentPeriod];
                     if(session) {
                        // Check for teacher conflicts
                        if(!teacherCounts[session.teacher]) teacherCounts[session.teacher] = [];
                        if (teacherCounts[session.teacher].includes(`${currentDay}-${currentPeriod}`)) {
                            // conflict
                        } else {
                            teacherCounts[session.teacher].push(`${currentDay}-${currentPeriod}`);
                        }

                        // Check for class conflicts
                        if(!classCounts[session.className]) classCounts[session.className] = [];
                        if (classCounts[session.className].includes(`${currentDay}-${currentPeriod}`)) {
                           // conflict
                        } else {
                           classCounts[session.className].push(`${currentDay}-${currentPeriod}`);
                        }
                     }
                 }
             }

        }
    }
     // New conflict detection logic
     const conflictsFound: Conflict[] = [];
     const schedule: { [key: string]: { teachers: string[], classes: string[] } } = {};
 
     for (const day of DAYS) {
         for (let period = 0; period < PERIOD_COUNT; period++) {
             const key = `${day}-${period}`;
             schedule[key] = { teachers: [], classes: [] };
             const session = timetable[day]?.[period];
             if (session) {
                schedule[key].teachers.push(session.teacher);
                schedule[key].classes.push(session.className);
             }
         }
     }

     for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const teacherBookings: {[key:string]: string[]} = {};
            const classBookings: {[key:string]: string[]} = {};

            const session = timetable[day]?.[period];
            if (!session) continue;
            
            // Teacher conflict
            if (teacherBookings[session.teacher]) {
                teacherBookings[session.teacher].forEach(id => conflictsFound.push({ id, type: 'teacher', message: `Teacher ${session.teacher} is double-booked.`}));
                conflictsFound.push({ id: session.id, type: 'teacher', message: `Teacher ${session.teacher} is double-booked.`});
            } else {
                teacherBookings[session.teacher] = [session.id];
            }

            // Class conflict
             if (classBookings[session.className]) {
                classBookings[session.className].forEach(id => conflictsFound.push({ id, type: 'class', message: `Class ${session.className} is double-booked.`}));
                conflictsFound.push({ id: session.id, type: 'class', message: `Class ${session.className} is double-booked.`});
            } else {
                classBookings[session.className] = [session.id];
            }
        }
    }


    setConflicts(conflictsFound.filter((c, i, a) => a.findIndex(t => t.id === c.id) === i)); // unique conflicts
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
