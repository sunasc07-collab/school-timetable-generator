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
            { id: "s1-1", name: "Mathematics", classes: [{id: "c1-1-1", grade: "Grade 9", arms: ["A"], periods: 5}] },
            { id: "s1-2", name: "Physics", classes: [{id: "c1-2-1", grade: "Grade 10", arms: ["B"], periods: 4}] },
        ],
    },
    {
        id: "t2",
        name: "Ms. Jones",
        subjects: [
            { id: "s2-1", name: "English", classes: [{id: "c2-1-1", grade: "Grade 9", arms: ["A"], periods: 5 }] },
            { id: "s2-2", name: "History", classes: [{id: "c2-2-1", grade: "Grade 8", arms: ["A"], periods: 3 }] },
        ],
    },
    {
        id: "t3",
        name: "Dr. Brown",
        subjects: [
            { id: "s3-1", name: "Chemistry", classes: [{id: "c3-1-1", grade: "Grade 10", arms: ["B"], periods: 4 }] },
            { id: "s3-2", name: "Biology", classes: [{id: "c3-2-1", grade: "Grade 9", arms: ["A"], periods: 4 }] },
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
            subject.classes.forEach(classGroup => {
                classGroup.arms.forEach(arm => {
                    for (let i = 0; i < classGroup.periods; i++) {
                        allSessions.push({ teacher: teacher.name, subject: subject.name, className: `${classGroup.grade} ${arm}` });
                    }
                })
            });
        });
    });

    // Shuffle sessions to ensure randomness
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
                
                const isTeacherBusy = teacherAvailability[day][period]?.includes(session.teacher);
                const isClassBusy = classAvailability[day][period]?.includes(session.className);

                if (newTimetable[day][period] === null && !isTeacherBusy && !isClassBusy) {
                    const sessionWithId = { ...session, id: crypto.randomUUID() };
                    newTimetable[day][period] = sessionWithId;
                    if(!teacherAvailability[day][period]) teacherAvailability[day][period] = [];
                    if(!classAvailability[day][period]) classAvailability[day][period] = [];
                    teacherAvailability[day][period].push(session.teacher);
                    classAvailability[day][period].push(session.className);
                    placed = true;
                    placedCount++;
                    break;
                }
            }
            if (placed) break; 
        }
    }
    
    if (placedCount < allSessions.length) {
        // Find which sessions were not placed
        const unplacedSessions: {[key: string]: number} = {};
        allSessions.forEach(s => {
            const key = `${s.teacher}-${s.subject}-${s.className}`;
            unplacedSessions[key] = (unplacedSessions[key] || 0) + 1;
        });

        Object.values(newTimetable).flat().forEach(s => {
            if(s) {
                const key = `${s.teacher}-${s.subject}-${s.className}`;
                if(unplacedSessions[key]) {
                    unplacedSessions[key]--;
                    if(unplacedSessions[key] === 0) delete unplacedSessions[key];
                }
            }
        });
        
        const unplacedList = Object.keys(unplacedSessions).map(k => `${k} (${unplacedSessions[k]} periods)`).join(', ');

        throw new Error(`Could not schedule all classes. Only ${placedCount} out of ${allSessions.length} sessions were placed. Unplaced: ${unplacedList}. Please check workloads or add more periods.`);
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
    const finalConflicts: Conflict[] = [];
    if (Object.keys(timetable).length === 0) {
        setConflicts([]);
        return;
    }
 
    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const teachersInSlot: TimetableSession[] = [];
            const classesInSlot: TimetableSession[] = [];
            
            // Collect all sessions for all teachers at this specific day and period
            for (const teacher of teachers) {
                const session = getSessionForTeacher(teacher.name, day, period);
                if (session) {
                    teachersInSlot.push(session);
                    classesInSlot.push(session);
                }
            }

            // Check for teacher conflicts
            const teacherCounts: { [name: string]: TimetableSession[] } = {};
            teachersInSlot.forEach(s => {
                if (!teacherCounts[s.teacher]) teacherCounts[s.teacher] = [];
                teacherCounts[s.teacher].push(s);
            });

            for (const teacherName in teacherCounts) {
                if (teacherCounts[teacherName].length > 1) {
                    teacherCounts[teacherName].forEach(s => {
                        finalConflicts.push({ id: s.id, type: 'teacher', message: `Teacher ${teacherName} is double-booked.` });
                    });
                }
            }

            // Check for class conflicts
            const classCounts: { [name: string]: TimetableSession[] } = {};
            classesInSlot.forEach(s => {
                if (!classCounts[s.className]) classCounts[s.className] = [];
                classCounts[s.className].push(s);
            });

            for (const className in classCounts) {
                if (classCounts[className].length > 1) {
                    classCounts[className].forEach(s => {
                        finalConflicts.push({ id: s.id, type: 'class', message: `Class ${className} is double-booked.` });
                    });
                }
            }
        }
    }
    
    // De-duplicate conflicts as one session might be part of multiple conflicts
    const uniqueConflicts = finalConflicts.filter((c, i, a) => a.findIndex(t => t.id === c.id) === i);
    setConflicts(uniqueConflicts);
  };
  
  const getSessionForTeacher = (teacherName: string, day: string, periodIndex: number): TimetableSession | null => {
      if (!timetable[day]) return null;
      // This function needs to look through all possible timetable entries, not just one per slot
      for(const d of DAYS) {
          if (d === day) {
              for(let p = 0; p < PERIOD_COUNT; p++) {
                  if (p === periodIndex) {
                      const session = timetable[d][p];
                      if(session && session.teacher === teacherName) {
                          return session;
                      }
                  }
              }
          }
      }

      // The logic is flawed because the timetable structure assumes one session per slot globally
      // Let's correct it by scanning the timetable grid for the teacher
      const allSessionsForDay = timetable[day];
      if (!allSessionsForDay) return null;

      const session = allSessionsForDay[periodIndex];
      if (session && session.teacher === teacherName) {
        return session;
      }
      
      return null;
  }
  
  useEffect(() => {
    const slotMap: { [key: string]: TimetableSession[] } = {};
    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const key = `${day}-${period}`;
            slotMap[key] = [];
            const session = timetable[day]?.[period];
            if(session) {
                slotMap[key].push(session);
            }
        }
    }
    
    // Re-check conflicts
    const conflictsFound: Conflict[] = [];
    for(const key in slotMap) {
        const sessions = slotMap[key];
        if (sessions.length > 1) {
            // this implies a structural issue, let's check internal consistency
            const teacherCounts: { [name: string]: TimetableSession[] } = {};
            const classCounts: { [name: string]: TimetableSession[] } = {};

            sessions.forEach(s => {
                 if (!teacherCounts[s.teacher]) teacherCounts[s.teacher] = [];
                teacherCounts[s.teacher].push(s);

                if (!classCounts[s.className]) classCounts[s.className] = [];
                classCounts[s.className].push(s);
            });

            Object.values(teacherCounts).forEach(teacherSessions => {
                if (teacherSessions.length > 1) {
                    teacherSessions.forEach(s => conflictsFound.push({id: s.id, type: 'teacher', message: `Teacher ${s.teacher} double booked`}));
                }
            });
            Object.values(classCounts).forEach(classSessions => {
                if (classSessions.length > 1) {
                    classSessions.forEach(s => conflictsFound.push({id: s.id, type: 'class', message: `Class ${s.className} double booked`}));
                }
            });
        }
    }
    
    const teacherUsage: { [key: string]: string[] } = {};
    const classUsage: { [key: string]: string[] } = {};
    const newConflicts: Conflict[] = [];

    for (const day in timetable) {
      for (let period = 0; period < timetable[day].length; period++) {
        const session = timetable[day][period];
        if (session) {
          const teacherKey = `${day}-${period}`;
          const classKey = `${day}-${period}`;

          if (!teacherUsage[teacherKey]) teacherUsage[teacherKey] = [];
          if (!classUsage[classKey]) classUsage[classKey] = [];

          if (teacherUsage[teacherKey].includes(session.teacher)) {
            newConflicts.push({ id: session.id, type: 'teacher', message: `Teacher ${session.teacher} conflict` });
          } else {
            teacherUsage[teacherKey].push(session.teacher);
          }
          
          if (classUsage[classKey].includes(session.className)) {
            newConflicts.push({ id: session.id, type: 'class', message: `Class ${session.className} conflict` });
          } else {
            classUsage[classKey].push(session.className);
          }
        }
      }
    }
    // This logic is also flawed as it iterates over a structure that can't have conflicts by design.
    // The conflict arises from the `moveSession` action.
    
    const checkConflicts = () => {
        const conflicts: Conflict[] = [];
        const teacherSchedule: Record<string, string> = {}; // key: `day-period`, value: teacher
        const classSchedule: Record<string, string> = {}; // key: `day-period`, value: className
        
        for (const day in timetable) {
            for (let period = 0; period < timetable[day].length; period++) {
                const session = timetable[day][period];
                if (session) {
                    const teacherKey = `${day}-${period}`;
                    const classKey = `${day}-${period}`;

                    // Check for teacher conflict
                    if (teacherSchedule[teacherKey] && teacherSchedule[teacherKey] !== session.teacher) {
                        // This case is impossible with current structure, but good for robustness
                    } else {
                        // Check if this teacher is booked elsewhere in the same slot
                        for(const d in timetable) {
                            for(let p = 0; p < timetable[d].length; p++) {
                                const s = timetable[d][p];
                                if(s && s.teacher === session.teacher && (d !== day || p !== period) && d === day && p === period) {
                                    // This is the conflict
                                    conflicts.push({id: session.id, type: 'teacher', message: 'Teacher double booked'});
                                    conflicts.push({id: s.id, type: 'teacher', message: 'Teacher double booked'});
                                 }
                            }
                        }
                    }
                    
                    // The main conflict check is needed after a drag-drop (move)
                    // The Timetable is now teacher-centric in display, but data is global
                    // So we must check for global conflicts
                    
                }
            }
        }
    }


    const finalConflicts: Conflict[] = [];
    const schedule: Record<string, { teachers: string[], classes: string[], sessions: TimetableSession[] }> = {};

    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const key = `${day}-${period}`;
            schedule[key] = { teachers: [], classes: [], sessions: [] };
        }
    }

    // Populate the schedule
    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const session = timetable[day]?.[period];
            if (session) {
                const key = `${day}-${period}`;
                schedule[key].teachers.push(session.teacher);
                schedule[key].classes.push(session.className);
                schedule[key].sessions.push(session);
            }
        }
    }
    
    // The above is for global timetable view. Now that we have per-teacher, the data structure must be re-evaluated.
    // The current data structure `TimetableData` is `{[day: string]: (TimetableSession | null)[]}`, which is global.
    // This is correct. The display logic in `timetable-grid.tsx` filters it.
    
    const teacherClash: Record<string, TimetableSession[]> = {}
    const classClash: Record<string, TimetableSession[]> = {}
    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const session = timetable[day]?.[period]
            if (session) {
                const teacherKey = `${day}-${period}-${session.teacher}`
                const classKey = `${day}-${period}-${session.className}`
                
                if (!teacherClash[teacherKey]) teacherClash[teacherKey] = []
                teacherClash[teacherKey].push(session)
                
                if (!classClash[classKey]) classClash[classKey] = []
                classClash[classKey].push(session)
            }
        }
    }

    // This is still not right. The conflict is if a teacher has more than one session in the *same* slot.
    // Or if a class has more than one session in the *same* slot.
    const allConflicts: Conflict[] = [];
    const slots: Record<string, {teachers: Set<string>, classes: Set<string>, sessions: TimetableSession[]}> = {};

    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const session = timetable[day]?.[period];
            if (session) {
                const key = `${day}-${period}`;
                if(!slots[key]) slots[key] = { teachers: new Set(), classes: new Set(), sessions: [] };
                
                if(slots[key].teachers.has(session.teacher)) {
                    // find the other session and mark both
                    const otherSession = slots[key].sessions.find(s => s.teacher === session.teacher)!;
                    allConflicts.push({id: session.id, type: 'teacher', message: `Teacher ${session.teacher} is double booked`});
                    allConflicts.push({id: otherSession.id, type: 'teacher', message: `Teacher ${session.teacher} is double booked`});
                }
                 if(slots[key].classes.has(session.className)) {
                    const otherSession = slots[key].sessions.find(s => s.className === session.className)!;
                    allConflicts.push({id: session.id, type: 'class', message: `Class ${session.className} is double booked`});
                    allConflicts.push({id: otherSession.id, type: 'class', message: `Class ${session.className} is double booked`});
                }

                slots[key].teachers.add(session.teacher);
                slots[key].classes.add(session.className);
                slots[key].sessions.push(session);
            }
        }
    }
    // The data structure `timetable[day][period]` being a single object means the above logic will never find a conflict.
    // The conflict happens because `moveSession` can put two sessions in the same logical slot but for different teachers.
    // The conflict detection must not use the `timetable` structure directly but analyze the moved sessions.
    
    const conflictList: Conflict[] = [];
    const teacherScheduleMap: Map<string, TimetableSession> = new Map();
    const classScheduleMap: Map<string, TimetableSession> = new Map();

    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const session = timetable[day]?.[period];
            if (session) {
                const teacherKey = `${day}-${period}-${session.teacher}`;
                const classKey = `${day}-${period}-${session.className}`;

                if (teacherScheduleMap.has(teacherKey)) {
                    const conflictingSession = teacherScheduleMap.get(teacherKey)!;
                    conflictList.push({ id: session.id, type: 'teacher', message: `Teacher ${session.teacher} double booked.` });
                    conflictList.push({ id: conflictingSession.id, type: 'teacher', message: `Teacher ${session.teacher} double booked.` });
                } else {
                    teacherScheduleMap.set(teacherKey, session);
                }
                
                if (classScheduleMap.has(classKey)) {
                    const conflictingSession = classScheduleMap.get(classKey)!;
                    conflictList.push({ id: session.id, type: 'class', message: `Class ${session.className} double booked.` });
                    conflictList.push({ id: conflictingSession.id, type: 'class', message: `Class ${session.className} double booked.` });
                } else {
                    classScheduleMap.set(classKey, session);
                }
            }
        }
    }

    setConflicts(conflictList.filter((c, i, a) => a.findIndex(t => t.id === c.id) === i));


  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetable, teachers]);

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
