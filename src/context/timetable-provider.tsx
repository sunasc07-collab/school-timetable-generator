
"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import type { Teacher, Subject, TimetableData, TimetableSession, Conflict, TimeSlot, ClassAssignment } from "@/lib/types";

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
            { id: "s1-1", name: "Mathematics", assignments: [{id: "ca1-1-1", grades: ["Grade 9"], arms: ["A"], periods: 5 }] },
            { id: "s1-2", name: "Physics", assignments: [{id: "ca1-2-1", grades: ["Grade 10"], arms: ["B"], periods: 4 }] },
        ],
    },
    {
        id: "t2",
        name: "Ms. Jones",
        subjects: [
            { id: "s2-1", name: "English", assignments: [{id: "ca2-1-1", grades: ["Grade 9"], arms: ["A"], periods: 5 }] },
            { id: "s2-2", name: "History", assignments: [{id: "ca2-2-1", grades: ["Grade 8"], arms: ["A"], periods: 3 }] },
        ],
    },
    {
        id: "t3",
        name: "Dr. Brown",
        subjects: [
            { id: "s3-1", name: "Chemistry", assignments: [{id: "ca3-1-1", grades: ["Grade 10"], arms: ["B"], periods: 4 }] },
            { id: "s3-2", name: "Biology", assignments: [{id: "ca3-2-1", grades: ["Grade 9"], arms: ["A"], periods: 4 }] },
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

// This maps a period index (0-8) to its corresponding slot index in TIME_SLOTS (0-10)
const periodToSlotIndex: number[] = [];
TIME_SLOTS.forEach((slot, index) => {
    if (!slot.isBreak) {
        periodToSlotIndex.push(index);
    }
});


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
          assignments: s.assignments.map(a => ({
            ...a, 
            id: crypto.randomUUID()
        }))
      })),
    };
    setTeachers((prev) => [...prev, newTeacher]);
  };

  const removeTeacher = (id: string) => {
    setTeachers((prev) => prev.filter((teacher) => teacher.id !== id));
    // Also remove from timetable if they exist
    setTimetable(prev => {
        const newTimetable = JSON.parse(JSON.stringify(prev));
        for(const day in newTimetable) {
            newTimetable[day] = newTimetable[day].map((session: TimetableSession | null) => {
                if (session && teachers.find(t => t.id === id)?.name === session.teacher) {
                    return null;
                }
                return session;
            })
        }
        return newTimetable;
    });
  };
  
  const updateTeacher = (id: string, name: string, subjects: Subject[]) => {
    const oldTeacherName = teachers.find(t => t.id === id)?.name;
    setTeachers(prev => prev.map(t => t.id === id ? { id, name, subjects } : t));
    // Update name in existing timetable
     if (oldTeacherName && oldTeacherName !== name) {
        setTimetable(prev => {
            const newTimetable = JSON.parse(JSON.stringify(prev));
            for (const day in newTimetable) {
                newTimetable[day] = newTimetable[day].map((session: TimetableSession | null) => {
                    if (session && session.teacher === oldTeacherName) {
                        return { ...session, teacher: name };
                    }
                    return session;
                });
            }
            return newTimetable;
        });
    }
  };

const generateLocalTimetable = () => {
    // 1. Plan all sessions to be scheduled
    const sessionPlans: { teacher: string; subject: string; className: string; periods: number; isDouble: boolean }[] = [];
    teachers.forEach(teacher => {
        teacher.subjects.forEach(subject => {
            subject.assignments.forEach(assignment => {
                assignment.grades.forEach(grade => {
                    assignment.arms.forEach(arm => {
                        const className = `${grade} ${arm}`;
                        let remainingPeriods = assignment.periods;
                        
                        // Rule: Only one double period is allowed for a week
                        if (remainingPeriods >= 2) {
                            sessionPlans.push({ teacher: teacher.name, subject: subject.name, className, periods: 2, isDouble: true });
                            remainingPeriods -= 2;
                        }

                        for (let i = 0; i < remainingPeriods; i++) {
                            sessionPlans.push({ teacher: teacher.name, subject: subject.name, className, periods: 1, isDouble: false });
                        }
                    });
                });
            });
        });
    });

    // Shuffle plans to ensure randomness
    for (let i = sessionPlans.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sessionPlans[i], sessionPlans[j]] = [sessionPlans[j], sessionPlans[i]];
    }

    const newTimetable: TimetableData = {};
    const teacherAvailability: { [key: string]: boolean } = {}; // key: `day-period-teacher`
    const classAvailability: { [key: string]: boolean } = {}; // key: `day-period-class`

    for (const day of DAYS) {
        newTimetable[day] = new Array(PERIOD_COUNT).fill(null);
    }
    
    let placedCount = 0;

    for (const plan of sessionPlans) {
        let placed = false;
        const randomDayOffset = Math.floor(Math.random() * DAYS.length);
        const randomPeriodOffset = Math.floor(Math.random() * PERIOD_COUNT);

        for (let i = 0; i < DAYS.length; i++) {
            const day = DAYS[(i + randomDayOffset) % DAYS.length];
            for (let j = 0; j < PERIOD_COUNT; j++) {
                const period = (j + randomPeriodOffset) % PERIOD_COUNT;

                if (plan.isDouble) {
                    if (period + 1 >= PERIOD_COUNT) continue; // Can't fit double period

                    // Check if the two consecutive slots cross a break
                    const slotIndex1 = periodToSlotIndex[period];
                    const slotIndex2 = periodToSlotIndex[period + 1];
                    if (slotIndex2 !== slotIndex1 + 1) continue;

                    const isTeacherBusy1 = teacherAvailability[`${day}-${period}-${plan.teacher}`];
                    const isClassBusy1 = classAvailability[`${day}-${period}-${plan.className}`];
                    const isTeacherBusy2 = teacherAvailability[`${day}-${period + 1}-${plan.teacher}`];
                    const isClassBusy2 = classAvailability[`${day}-${period + 1}-${plan.className}`];

                    if (!newTimetable[day][period] && !newTimetable[day][period + 1] && !isTeacherBusy1 && !isClassBusy1 && !isTeacherBusy2 && !isClassBusy2) {
                        const session1 = { ...plan, id: crypto.randomUUID(), isDouble: true, part: 1 };
                        const session2 = { ...plan, id: crypto.randomUUID(), isDouble: true, part: 2 };
                        
                        newTimetable[day][period] = session1;
                        newTimetable[day][period + 1] = session2;
                        
                        teacherAvailability[`${day}-${period}-${plan.teacher}`] = true;
                        classAvailability[`${day}-${period}-${plan.className}`] = true;
                        teacherAvailability[`${day}-${period + 1}-${plan.teacher}`] = true;
                        classAvailability[`${day}-${period + 1}-${plan.className}`] = true;
                        
                        placed = true;
                        break;
                    }
                } else { // Single period
                    const isTeacherBusy = teacherAvailability[`${day}-${period}-${plan.teacher}`];
                    const isClassBusy = classAvailability[`${day}-${period}-${plan.className}`];
                    
                    if (!newTimetable[day][period] && !isTeacherBusy && !isClassBusy) {
                        const session = { ...plan, id: crypto.randomUUID(), isDouble: false };
                        newTimetable[day][period] = session;
                        teacherAvailability[`${day}-${period}-${plan.teacher}`] = true;
                        classAvailability[`${day}-${period}-${plan.className}`] = true;
                        placed = true;
                        break;
                    }
                }
            }
            if (placed) break;
        }
        if (placed) placedCount++;
    }

    const totalPeriodsToPlace = sessionPlans.reduce((acc, p) => acc + p.periods, 0);
    const totalPeriodsPlaced = Object.values(newTimetable).flat().filter(Boolean).length;

    if (totalPeriodsPlaced < totalPeriodsToPlace) {
         throw new Error(`Could not schedule all classes. Only ${totalPeriodsPlaced} out of ${totalPeriodsToPlace} periods were placed. Please check teacher workloads or add more time slots.`);
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

        // Handle double periods
        if (session.isDouble) {
            const otherPart = session.part === 1 ? 2 : 1;
            const otherFromPeriod = session.part === 1 ? from.period + 1 : from.period - 1;
            const otherToPeriod = session.part === 1 ? to.period + 1 : to.period - 1;

            if (otherFromPeriod >= 0 && otherFromPeriod < PERIOD_COUNT) {
                 const otherSession = newTimetable[from.day][otherFromPeriod];
                 if (otherSession && otherSession.subject === session.subject && otherSession.className === session.className && otherSession.isDouble) {
                     // This is likely the other part, move it too if the target is valid
                     if (otherToPeriod >= 0 && otherToPeriod < PERIOD_COUNT && !newTimetable[to.day][otherToPeriod]) {
                         newTimetable[to.day][otherToPeriod] = otherSession;
                         newTimetable[from.day][otherFromPeriod] = null;
                     }
                 }
            }
        }


        return newTimetable;
    });
  }

  useEffect(() => {
    if (Object.keys(timetable).length === 0) {
      setConflicts([]);
      return;
    }

    // Corrected Conflict Detection
    const identifiedConflicts = new Map<string, Conflict>();

    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const sessionsInSlot = Object.values(timetable)
                .map(daySessions => daySessions[period])
                .filter((s): s is TimetableSession => s !== null);

            const teacherUsage = new Map<string, TimetableSession>();
            const classUsage = new Map<string, TimetableSession>();

            const currentSession = timetable[day]?.[period];
            if (!currentSession) continue;

             // Check for teacher conflict
            const teacherKey = `${day}-${period}-${currentSession.teacher}`;
            if (teacherUsage.has(teacherKey)) {
                const conflictingSession = teacherUsage.get(teacherKey)!;
                identifiedConflicts.set(currentSession.id, { id: currentSession.id, type: 'teacher', message: `Teacher ${currentSession.teacher} is double-booked.` });
                identifiedConflicts.set(conflictingSession.id, { id: conflictingSession.id, type: 'teacher', message: `Teacher ${conflictingSession.teacher} is double-booked.` });
            } else {
                teacherUsage.set(teacherKey, currentSession);
            }

            // Check for class conflict
            const classKey = `${day}-${period}-${currentSession.className}`;
            if (classUsage.has(classKey)) {
                 const conflictingSession = classUsage.get(classKey)!;
                 identifiedConflicts.set(currentSession.id, { id: currentSession.id, type: 'class', message: `Class ${currentSession.className} is double-booked.` });
                 identifiedConflicts.set(conflictingSession.id, { id: conflictingSession.id, type: 'class', message: `Class ${conflictingSession.className} is double-booked.` });
            } else {
                classUsage.set(classKey, currentSession);
            }
        }
    }
    
    // A better approach for conflict detection with the current global structure
    const teacherSlotUsage = new Map<string, TimetableSession>(); // key: `day-period-teacher`
    const classSlotUsage = new Map<string, TimetableSession>();   // key: `day-period-class`

    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const session = timetable[day]?.[period];
            if (!session) continue;

            const teacherKey = `${day}-${period}-${session.teacher}`;
            const classKey = `${day}-${period}-${session.className}`;

            // Check for class conflict
            if (classSlotUsage.has(classKey)) {
                 const conflictingSession = classSlotUsage.get(classKey)!;
                 if (conflictingSession.teacher !== session.teacher) {
                    identifiedConflicts.set(session.id, { id: session.id, type: 'class', message: `Class ${session.className} is double-booked.` });
                    identifiedConflicts.set(conflictingSession.id, { id: conflictingSession.id, type: 'class', message: `Class ${conflictingSession.className} is double-booked.` });
                 }
            } else {
                classSlotUsage.set(classKey, session);
            }

             // Check for teacher conflict
             if (teacherSlotUsage.has(teacherKey)) {
                const conflictingSession = teacherSlotUsage.get(teacherKey)!;
                if (conflictingSession.className !== session.className) {
                    identifiedConflicts.set(session.id, { id: session.id, type: 'teacher', message: `Teacher ${session.teacher} is double-booked.` });
                    identifiedConflicts.set(conflictingSession.id, { id: conflictingSession.id, type: 'teacher', message: `Teacher ${conflictingSession.teacher} is double-booked.` });
                }
            } else {
                teacherSlotUsage.set(teacherKey, session);
            }
        }
    }


    setConflicts(Array.from(identifiedConflicts.values()));

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
