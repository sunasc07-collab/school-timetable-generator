
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from "react";
import type { Teacher, TimetableData, TimetableSession, Conflict, TimeSlot, Timetable, ViewMode, SubjectAssignment, LockedSession } from "@/lib/types";

type TimetableContextType = {
  timetables: Timetable[];
  activeTimetable: Timetable | null;
  activeTimetableId: string | null;
  allTeachers: Teacher[];
  addTimetable: (name: string) => void;
  removeTimetable: (timetableId: string) => void;
  renameTimetable: (timetableId: string, newName: string) => void;
  setActiveTimetableId: (id: string | null) => void;

  addTeacher: (teacherData: Teacher) => void;
  removeTeacher: (teacherId: string) => void;
  updateTeacher: (teacherData: Teacher) => void;

  isTeacherEditorOpen: boolean;
  setIsTeacherEditorOpen: (isOpen: boolean) => void;
  editingTeacher: Teacher | null;
  setEditingTeacher: (teacher: Teacher | null) => void;

  addLockedSession: (session: Omit<LockedSession, 'id' | 'schoolId'>) => void;
  removeLockedSession: (sessionId: string) => void;
  
  generateTimetable: () => void;
  clearTimetable: () => void;
  moveSession: (session: TimetableSession, from: { day: string; period: number }, to: { day: string; period: number }) => void;
  resolveConflicts: () => void;
  isConflict: (sessionId: string) => boolean;
  
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  updateTimeSlots: (newTimeSlots: TimeSlot[]) => void;
  // Exposing these for the view components
  classes: string[];
  arms: string[];
};

const TimetableContext = createContext<TimetableContextType | undefined>(undefined);

const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DEFAULT_TIMESLOTS: TimeSlot[] = [
    { period: 1, time: '08:00-08:40', id: '1' },
    { period: 2, time: '08:40-09:20', id: '2' },
    { period: 3, time: '09:20-10:00', id: '3' },
    { period: null, time: '10:00-10:20', isBreak: true, label: 'Short Break', id: 'b1' },
    { period: 4, time: '10:20-11:00', id: '4' },
    { period: 5, time: '11:00-11:40', id: '5' },
    { period: 6, time: '11:40-12:20', id: '6' },
    { period: null, time: '12:20-13:00', isBreak: true, label: 'Lunch', id: 'b2' },
    { period: 7, time: '13:00-13:40', id: '7' },
    { period: 8, time: '13:40-14:20', id: '8' },
    { period: 9, time: '14:20-15:00', id: '9' },
];

const PRIMARY_SCHOOL_TIMESLOTS: TimeSlot[] = [
    { period: 1, time: '08:00-08:40', id: 'ps1' },
    { period: 2, time: '08:40-09:20', id: 'ps2' },
    { period: 3, time: '09:20-10:00', id: 'ps3' },
    { period: null, time: '10:00-10:30', isBreak: true, label: 'Snack Time', id: 'psb1' },
    { period: 4, time: '10:30-11:10', id: 'ps4' },
    { period: 5, time: '11:10-11:50', id: 'ps5' },
    { period: null, time: '11:50-12:50', isBreak: true, label: 'Lunch', id: 'psb2' },
    { period: 6, time: '12:50-13:30', id: 'ps6' },
    { period: 7, time: '13:30-14:10', id: 'ps7' },
];

const PRIMARY_SCHOOL_LOCKED_PERIODS: Omit<LockedSession, 'id' | 'schoolId'>[] = [
    { day: 'Mon', period: 1, activity: 'Assembly', className: 'all' },
    { day: 'Fri', period: 7, activity: 'Sports', className: 'all' },
];


const usePersistentState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [state, setState] = useState(() => {
        if (typeof window === 'undefined') {
            return defaultValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Error reading localStorage key “${key}”:`, error);
            return defaultValue;
        }
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(key, JSON.stringify(state));
            } catch (error) {
                console.warn(`Error setting localStorage key “${key}”:`, error);
            }
        }
    }, [key, state]);

    return [state, setState];
};

const createNewTimetable = (name: string, id?: string): Timetable => {
    const newId = id || `${Date.now()}-${Math.random()}`;
    const isPrimary = name.toLowerCase().includes('primary');

    const timeSlots = isPrimary ? PRIMARY_SCHOOL_TIMESLOTS : DEFAULT_TIMESLOTS;
    
    let lockedSessions: LockedSession[] = [];
    if (isPrimary) {
        lockedSessions = PRIMARY_SCHOOL_LOCKED_PERIODS.map(ls => ({
            ...ls,
            id: `${newId}-${ls.day}-${ls.period}-${Math.random()}`,
            schoolId: newId,
        }));
    }

    return {
        id: newId,
        name,
        timetable: {},
        classes: [],
        conflicts: [],
        days: DEFAULT_DAYS,
        timeSlots: JSON.parse(JSON.stringify(timeSlots.map(ts => ({...ts, id: `${newId}-${ts.id}`})))),
        error: null,
        lockedSessions: lockedSessions,
    };
}

type SingleSessionUnit = TimetableSession;
type DoubleSessionUnit = { session: TimetableSession; partner: TimetableSession };
type OptionBlockUnit = { sessions: TimetableSession[]; optionGroup: string; id: string };

type PlacementUnit = SingleSessionUnit | DoubleSessionUnit | OptionBlockUnit;

export function TimetableProvider({ children }: { children: ReactNode }) {
  const [timetables, setTimetables] = usePersistentState<Timetable[]>("timetables_data_v30", []);
  const [allTeachers, setAllTeachers] = usePersistentState<Teacher[]>("all_teachers_v30", []);
  const [activeTimetableId, setActiveTimetableId] = usePersistentState<string | null>("active_timetable_id_v30", null);
  const [viewMode, setViewMode] = usePersistentState<ViewMode>('timetable_viewMode_v30', 'class');
  const [isTeacherEditorOpen, setIsTeacherEditorOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  
  const activeTimetable = useMemo(() => {
    const currentTimetable = timetables.find(t => t.id === activeTimetableId);
    return currentTimetable || null;
  }, [activeTimetableId, timetables]);
  
  const updateTimetable = useCallback((timetableId: string, updates: Partial<Timetable>) => {
      setTimetables(prev => prev.map(t => t.id === timetableId ? { ...t, ...updates } : t));
  }, [setTimetables]);
  
  const findConflicts = useCallback((timetableId: string, newTimetableData?: TimetableData) => {
    setTimetables(prevTimetables => {
        const currentTT = prevTimetables.find(t => t.id === timetableId);
        if (!currentTT) return prevTimetables;

        const timetableToScan = newTimetableData || currentTT.timetable;
        if (!timetableToScan || Object.keys(timetableToScan).length === 0) {
            return prevTimetables.map(t => t.id === timetableId ? { ...t, conflicts: [] } : t);
        }

        const { days } = currentTT;
        const newConflicts: Conflict[] = [];

        days.forEach(day => {
            const daySlots = timetableToScan[day] || [];
            daySlots.forEach(slot => {
                if (!slot || slot.length <= 1) return;
                const period = slot[0]?.period;
                if (period === undefined) return;

                const teacherClashes = new Map<string, TimetableSession[]>();
                const classClashes = new Map<string, TimetableSession[]>();

                for (const session of slot) {
                    if (session.teacherId && !session.isLocked) {
                        if (!teacherClashes.has(session.teacherId)) {
                            teacherClashes.set(session.teacherId, []);
                        }
                        teacherClashes.get(session.teacherId)!.push(session);
                    }

                    for (const className of session.classes) {
                        if (!classClashes.has(className)) {
                            classClashes.set(className, []);
                        }
                        classClashes.get(className)!.push(session);
                    }
                }

                teacherClashes.forEach((sessions) => {
                    const uniqueOptionGroups = new Set(sessions.filter(s => s.optionGroup).map(s => s.optionGroup));
                    if (sessions.length - uniqueOptionGroups.size > 1) {
                        sessions.forEach(session => {
                            newConflicts.push({
                                id: session.id,
                                type: 'teacher',
                                message: `Teacher ${session.teacher} is double-booked on ${day} at period ${period}.`,
                            });
                        });
                    }
                });

                classClashes.forEach((sessions, className) => {
                    const nonLockedSessions = sessions.filter(s => !s.isLocked);
                    if (nonLockedSessions.length <= 1) return;

                    const uniqueSessionIds = new Set(nonLockedSessions.map(s => s.id));
                    if (uniqueSessionIds.size > 1) {
                        nonLockedSessions.forEach(session => {
                            newConflicts.push({
                                id: session.id,
                                type: 'class',
                                message: `Class ${className} is double-booked on ${day} at period ${period}.`,
                            });
                        });
                    }
                });
            });
        });
        
        return prevTimetables.map(t => t.id === timetableId ? { ...t, conflicts: newConflicts, timetable: timetableToScan } : t);
    });
}, [setTimetables]);
  
  useEffect(() => {
    if (timetables.length === 0) {
        const defaultTimetable = createNewTimetable("New School");
        setTimetables([defaultTimetable]);
        setActiveTimetableId(defaultTimetable.id);
    } else if (!activeTimetableId || !timetables.some(t => t.id === activeTimetableId)) {
        setActiveTimetableId(timetables[0]?.id || null);
    }
  }, [timetables, activeTimetableId, setTimetables, setActiveTimetableId]);

  const resetAllTimetables = useCallback(() => {
    setTimetables(prev => prev.map(t => ({
      ...t,
      timetable: {},
      classes: [],
      conflicts: [],
      error: null
    })));
  }, [setTimetables]);


  const addTimetable = (name: string) => {
      const newTimetable = createNewTimetable(name);
      setTimetables(prev => [...prev, newTimetable]);
      setActiveTimetableId(newTimetable.id);
  }

  const removeTimetable = (timetableId: string) => {
    setTimetables(prev => {
        const newTimetables = prev.filter(t => t.id !== timetableId);
        if (activeTimetableId === timetableId) {
            setActiveTimetableId(newTimetables[0]?.id || null);
        }
        return newTimetables;
    });
    setAllTeachers(prev => {
        const newTeachers = prev.map(teacher => ({
            ...teacher,
            assignments: teacher.assignments.filter(a => a.schoolId !== timetableId)
        }));
        return newTeachers.filter(teacher => teacher.assignments.length > 0);
    });
  }
  
  const renameTimetable = (timetableId: string, newName: string) => {
      updateTimetable(timetableId, { name: newName });
  }

  const addTeacher = (teacherData: Teacher) => {
    setAllTeachers(prev => {
        const newTeacher = { ...teacherData, id: teacherData.id || `${Date.now()}-${Math.random()}` };
        const newTeachers = [...prev, newTeacher];
        return newTeachers;
    });
    resetAllTimetables();
  };
  
  const updateTeacher = (teacherData: Teacher) => {
      setAllTeachers(prev => prev.map(t => (t.id === teacherData.id ? {...teacherData} : t)));
      resetAllTimetables();
  };

  const removeTeacher = (teacherId: string) => {
    setAllTeachers(prev => prev.filter(t => t.id !== teacherId));
    resetAllTimetables();
  };

  const updateTimeSlots = (newTimeSlots: TimeSlot[]) => {
    if (!activeTimetable) return;
    let periodCounter = 1;
    const renumberedTimeSlots = newTimeSlots.map(slot => {
        if (!slot.isBreak) {
            return { ...slot, period: periodCounter++ };
        }
        return { ...slot, period: null };
    });
    updateTimetable(activeTimetable.id, { timeSlots: renumberedTimeSlots });
    resetAllTimetables();
  }

  const addLockedSession = (session: Omit<LockedSession, 'id' | 'schoolId'>) => {
      if (!activeTimetable) return;

      const id = `${Date.now()}-${Math.random()}`;
      let newSessions: LockedSession[] = [];
      if(session.day === 'all_week') {
         newSessions = activeTimetable.days.map(day => ({
             ...session,
             id: `${id}-${day}`,
             day: day,
             schoolId: activeTimetable.id,
         }));
         newSessions.push({ ...session, id, schoolId: activeTimetable.id });
      } else {
         newSessions.push({ ...session, id, schoolId: activeTimetable.id });
      }
      
      updateTimetable(activeTimetable.id, { lockedSessions: [...(activeTimetable.lockedSessions || []), ...newSessions] });
      resetAllTimetables();
  };

  const removeLockedSession = (sessionId: string) => {
      if (!activeTimetable || !activeTimetable.lockedSessions) return;
      const sessionToRemove = activeTimetable.lockedSessions.find(s => s.id === sessionId);
      
      let sessionsToKeep = activeTimetable.lockedSessions;
      if (sessionToRemove?.day === 'all_week') {
          sessionsToKeep = sessionsToKeep.filter(s => !s.id.startsWith(sessionId));
      } else {
           sessionsToKeep = sessionsToKeep.filter(s => s.id !== sessionId);
           const weekEntryId = sessionToRemove?.id.substring(0, sessionToRemove.id.lastIndexOf('-'));
            if(weekEntryId) {
                sessionsToKeep = sessionsToKeep.filter(s => s.id !== weekEntryId);
            }
      }
      
      updateTimetable(activeTimetable.id, { lockedSessions: sessionsToKeep });
      resetAllTimetables();
  };
  
  const generateTimetable = () => {
    setTimetables(currentTimetables => {
        let allSolvedBoards: { [schoolId: string]: TimetableData } = {};
        const allClassSets: { [schoolId: string]: Set<string> } = {};

        const allCurrentSchoolAssignments = allTeachers.flatMap(teacher => 
            teacher.assignments
                .map(a => ({ ...a, teacherId: teacher.id, teacherName: teacher.name }))
        );

        // First, determine all classes for each school
        currentTimetables.forEach(tt => {
            allClassSets[tt.id] = new Set<string>();
            const assignmentsForSchool = allCurrentSchoolAssignments.filter(a => a.schoolId === tt.id);
            assignmentsForSchool.forEach(assignment => {
                if (assignment.grades.length === 0 && !assignment.subject.toLowerCase().includes('level')) { // Handle specialty school cases
                    const className = tt.name; // or a more appropriate name
                    allClassSets[tt.id].add(className);
                }
                assignment.grades.forEach(grade => {
                     (assignment.arms && assignment.arms.length > 0 ? assignment.arms : ['']).forEach(arm => {
                        const className = `${grade} ${arm}`.trim();
                        allClassSets[tt.id].add(className);
                    });
                });
            });
        });

        // Now, initialize boards and pre-fill locked sessions
        currentTimetables.forEach(tt => {
            allSolvedBoards[tt.id] = {};
            tt.days.forEach(day => {
                allSolvedBoards[tt.id][day] = [];
                const teachingPeriods = tt.timeSlots.filter(ts => ts.period !== null).map(ts => ts.period as number);
                for (let i = 0; i < teachingPeriods.length; i++) {
                     allSolvedBoards[tt.id][day].push([]);
                }
            });

            (tt.lockedSessions || []).filter(ls => ls.day !== 'all_week').forEach(ls => {
                const classNames = ls.className === 'all' 
                    ? Array.from(allClassSets[tt.id] || [])
                    : [ls.className];
                
                if (classNames.length === 0) return;
                
                const lockedSession: TimetableSession = {
                    id: ls.id,
                    subject: ls.activity,
                    className: ls.className,
                    classes: classNames,
                    teacher: 'SYSTEM',
                    isLocked: true,
                    isDouble: false,
                    period: ls.period,
                    schoolId: tt.id
                };

                let daySchedule = allSolvedBoards[tt.id][ls.day];
                const periodIndex = tt.timeSlots.filter(ts => ts.period !== null).findIndex(ts => ts.period === ls.period);

                if (periodIndex > -1) {
                    if (daySchedule[periodIndex]) {
                        daySchedule[periodIndex].push(lockedSession);
                    } else {
                        daySchedule[periodIndex] = [lockedSession];
                    }
                }
            });
        });
        
        
        const parseTimeToMinutes = (time: string): number => {
            if (!time || !time.includes(':')) return 0;
            const [hours, minutes] = time.split(':').map(Number);
            if (isNaN(hours) || isNaN(minutes)) return 0;
            return hours * 60 + minutes;
        };

        function isValidPlacement(
            boards: { [schoolId: string]: TimetableData }, 
            unit: PlacementUnit, 
            day: string,
            period: number
        ): boolean {
            const checkSession = (session: TimetableSession, p: number): boolean => {
                const schoolTimetable = currentTimetables.find(t => t.id === session.schoolId);
                if (!schoolTimetable) return false;

                const schoolPeriods = schoolTimetable.timeSlots.filter(ts => !ts.isBreak).map(ts => ts.period);
                if (!schoolPeriods.includes(p)) {
                    return false;
                }
                
                const assignment = allCurrentSchoolAssignments.find(a => 
                    a.teacherId === session.teacherId &&
                    a.schoolId === session.schoolId &&
                    a.subject === (session.actualSubject || session.subject) &&
                    (a.grades.length === 0 || a.grades.some(g => session.classes.some(c => c.startsWith(g))))
                );
                if (assignment && assignment.days && assignment.days.length > 0 && !assignment.days.includes(day)) {
                    return false;
                }
                
                const periodIndex = schoolTimetable.timeSlots.filter(ts => ts.period !== null).findIndex(ts => ts.period === p);
                if (periodIndex === -1) return false;
                
                const targetSlot = boards[session.schoolId]?.[day]?.[periodIndex];
                
                if (targetSlot && targetSlot.length > 0) {
                     if (targetSlot.some(s => s.isLocked)) {
                        const lockedSession = targetSlot.find(s => s.isLocked);
                        if (lockedSession) {
                            if (lockedSession.classes.includes('all') || session.classes.some(c => lockedSession.classes.includes(c))) {
                                return false; // Slot is locked for this class or all classes
                            }
                        }
                    }
                    if (targetSlot.some(s => s.classes.some(c => session.classes.includes(c)))) {
                        return false;
                    }
                }

                if (session.teacherId) {
                    const proposedTimeSlot = schoolTimetable.timeSlots.find(ts => ts.period === p);
                    if (!proposedTimeSlot) return false;

                    const [startStr, endStr] = proposedTimeSlot.time.split('-');
                    const proposedStart = parseTimeToMinutes(startStr);
                    const proposedEnd = parseTimeToMinutes(endStr);
                    
                    if (proposedStart >= proposedEnd) return false; 

                    for (const schoolId in boards) {
                        const board = boards[schoolId];
                        const otherSchoolConfig = currentTimetables.find(t => t.id === schoolId);
                        if (!otherSchoolConfig) continue;

                        const daySchedule = board[day] || [];
                        for (const slot of daySchedule) {
                            for (const existingSession of slot) {
                                if (existingSession.teacherId === session.teacherId) {
                                    const existingTimeSlot = otherSchoolConfig.timeSlots.find(ts => ts.period === existingSession.period);
                                    if (!existingTimeSlot) continue;

                                    const [existingStartStr, existingEndStr] = existingTimeSlot.time.split('-');
                                    const existingStart = parseTimeToMinutes(existingStartStr);
                                    const existingEnd = parseTimeToMinutes(existingEndStr);
                                    
                                    if (existingStart >= existingEnd) continue;
                                    
                                    if (proposedStart < existingEnd && proposedEnd > existingStart) {
                                        return false; 
                                    }
                                }
                            }
                        }
                    }
                }

                return true;
            };

            const schoolForUnit = currentTimetables.find(t => t.id === (('sessions' in unit) ? unit.sessions[0].schoolId : ('session' in unit ? unit.session.schoolId : unit.schoolId)));
            if (!schoolForUnit) return false;

            if ('partner' in unit) { // Double Period
                 const teachingPeriodsForDay = schoolForUnit.timeSlots
                    .filter(ts => !ts.isBreak || !(ts.days || schoolForUnit.days).includes(day))
                    .map(ts => ts.period).filter((p): p is number => p !== null).sort((a,b) => a-b);
                
                const periodSlotIndexInDay = teachingPeriodsForDay.indexOf(period);
                if (periodSlotIndexInDay === -1 || periodSlotIndexInDay + 1 >= teachingPeriodsForDay.length) return false;
                
                const nextTeachingPeriod = teachingPeriodsForDay[periodSlotIndexInDay + 1];

                const periodSlotObjIndex = schoolForUnit.timeSlots.findIndex(p => p.period === period);
                const nextPeriodSlotObjIndex = schoolForUnit.timeSlots.findIndex(p => p.period === nextTeachingPeriod);

                if (periodSlotObjIndex === -1 || nextPeriodSlotObjIndex === -1) return false;
                
                if (periodSlotObjIndex + 1 !== nextPeriodSlotObjIndex) {
                    return false;
                }

                return checkSession(unit.session, period) && checkSession(unit.partner, nextTeachingPeriod);
            } else if ('sessions' in unit) { // Option Block
                for (const s of unit.sessions) {
                  if (!checkSession(s, period)) return false;
                }
                return true;
            } else { // Single Period
                return checkSession(unit, period);
            }
        }
        
        function solve(boards: { [schoolId: string]: TimetableData }, units: PlacementUnit[]): [boolean, { [schoolId: string]: TimetableData }] {
            if (units.length === 0) return [true, boards];

            const unit = units[0];
            const remainingUnits = units.slice(1);
            
            const schoolForUnit = currentTimetables.find(t => t.id === (('sessions' in unit) ? unit.sessions[0].schoolId : ('session' in unit ? unit.session.schoolId : unit.schoolId)));
            if (!schoolForUnit) return solve(boards, remainingUnits);

            const schoolPeriods = (schoolForUnit.timeSlots || [])
                .filter(ts => ts.period !== null)
                .map(ts => ts.period as number);

            for (const day of schoolForUnit.days) {
                for (const period of schoolPeriods) {
                    if (isValidPlacement(boards, unit, day, period)) {
                       const newBoards = JSON.parse(JSON.stringify(boards));
                       
                       const placeSession = (session: TimetableSession, p: number) => {
                           let daySchedule = newBoards[session.schoolId][day];
                           const periodIndex = schoolForUnit.timeSlots.filter(ts => ts.period !== null).findIndex(ts => ts.period === p);
                           if (periodIndex !== -1) {
                               const newSessionData = { ...session, period: p, day: day };
                               if (daySchedule[periodIndex]) {
                                   daySchedule[periodIndex].push(newSessionData);
                               } else {
                                   daySchedule[periodIndex] = [newSessionData];
                               }
                           }
                       };

                       if ('partner' in unit) {
                           placeSession(unit.session, period);
                           
                           const teachingPeriodsForDay = schoolForUnit.timeSlots
                               .filter(ts => !ts.isBreak || !(ts.days || schoolForUnit.days).includes(day))
                               .map(ts => ts.period).filter((p): p is number => p !== null).sort((a,b) => a-b);
                           const periodSlotIndex = teachingPeriodsForDay.indexOf(period);
                           const partnerPeriod = teachingPeriodsForDay[periodSlotIndex + 1];

                           placeSession(unit.partner, partnerPeriod);
                       } else if ('sessions' in unit) {
                           unit.sessions.forEach(s => placeSession(s, period));
                       } else {
                           placeSession(unit, period);
                       }
                       
                       const [solved, finalBoards] = solve(newBoards, remainingUnits);
                       if (solved) return [true, finalBoards];
                    }
                }
            }
            return [false, boards];
        }
        
        const allUnits: PlacementUnit[] = [];
        
        const primaryAssignments = allCurrentSchoolAssignments.filter(a => {
            const school = currentTimetables.find(t => t.id === a.schoolId);
            return school && !school.name.toLowerCase().includes('secondary');
        });
        
        const secondaryCoreAssignments = allCurrentSchoolAssignments.filter(a => {
            const school = currentTimetables.find(t => t.id === a.schoolId);
            return school && school.name.toLowerCase().includes('secondary') && a.subjectType === 'core';
        });

        const secondaryOptionalAssignments = allCurrentSchoolAssignments.filter(a => {
            const school = currentTimetables.find(t => t.id === a.schoolId);
            return school && school.name.toLowerCase().includes('secondary') && a.subjectType === 'optional';
        });

        primaryAssignments.forEach(assignment => {
            if (assignment.grades.length === 0) {
                 const className = currentTimetables.find(t => t.id === assignment.schoolId)?.name || '';
                 if (!className) return;
                 for (let i = 0; i < assignment.periods; i++) {
                    allUnits.push({
                        id: `${Date.now()}-${Math.random()}`, subject: assignment.subject, teacher: assignment.teacherName!, teacherId: assignment.teacherId!, className, classes: [className], isDouble: false, period: 0, schoolId: assignment.schoolId, actualSubject: assignment.subject
                    });
                }
            } else {
                assignment.grades.forEach(grade => {
                    (assignment.arms && assignment.arms.length > 0 ? assignment.arms : ['']).forEach(arm => {
                        const className = `${grade} ${arm}`.trim();
                        for (let i = 0; i < assignment.periods; i++) {
                            allUnits.push({
                                id: `${Date.now()}-${Math.random()}`, subject: assignment.subject, teacher: assignment.teacherName!, teacherId: assignment.teacherId!, className, classes: [className], isDouble: false, period: 0, schoolId: assignment.schoolId, actualSubject: assignment.subject
                            });
                        }
                    });
                });
            }
        });

        secondaryCoreAssignments.forEach(assignment => {
            assignment.grades.forEach(grade => {
                (assignment.arms || ['']).forEach(arm => {
                    const className = `${grade} ${arm}`.trim();
                    for (let i = 0; i < assignment.periods; i++) {
                        allUnits.push({
                            id: `${Date.now()}-${Math.random()}`, subject: assignment.subject, teacher: assignment.teacherName!, teacherId: assignment.teacherId!, className, classes: [className], isDouble: false, period: 0, schoolId: assignment.schoolId, actualSubject: assignment.subject
                        });
                    }
                });
            });
        });
        
        const optionalGroups = new Map<string, { assignments: (SubjectAssignment & { teacherName: string, teacherId: string })[]; grades: string[], schoolId: string }>();
        
        secondaryOptionalAssignments.forEach(assignment => {
            if (assignment.optionGroup) {
                assignment.grades.forEach(grade => {
                    const key = `${assignment.schoolId}-${grade}-${assignment.optionGroup}`;
                    if (!optionalGroups.has(key)) {
                        optionalGroups.set(key, { assignments: [], grades: [grade], schoolId: assignment.schoolId });
                    }
                    optionalGroups.get(key)!.assignments.push(assignment);
                });
            }
        });
        
        optionalGroups.forEach(group => {
            const { assignments, grades, schoolId } = group;
            const firstAssignment = assignments[0];
            if (!firstAssignment) return;
            
            const periods = firstAssignment.periods;
            const optionGroup = firstAssignment.optionGroup!;
            const grade = grades[0];

            const allArmsForGroup = [...new Set(assignments.flatMap(a => a.arms || []))];
            
            const classNamesForBlock = allArmsForGroup.length > 0 
                ? allArmsForGroup.map(arm => `${grade} ${arm}`.trim())
                : [`${grade}`.trim()];
            
            for (let i = 0; i < periods; i++) {
                const blockId = `${Date.now()}-${Math.random()}`;
                const optionSessions: TimetableSession[] = [];
                
                assignments.forEach(assignment => {
                    optionSessions.push({
                        id: `${blockId}-${assignment.teacherId}-${assignment.subject}`,
                        subject: `Option ${optionGroup}`,
                        actualSubject: assignment.subject,
                        teacher: assignment.teacherName!,
                        teacherId: assignment.teacherId!,
                        isDouble: false,
                        period: 0,
                        schoolId: schoolId,
                        optionGroup: optionGroup,
                        className: grade, 
                        classes: classNamesForBlock,
                    });
                });

                if (optionSessions.length > 0) {
                     allUnits.push({ id: blockId, sessions: optionSessions, optionGroup: optionGroup });
                }
            }
        });
        
        const shuffledUnits = allUnits.sort(() => Math.random() - 0.5);
        const sortedAllUnits = shuffledUnits.sort((a, b) => ('sessions' in b ? 1 : 0) - ('sessions' in a ? 1 : 0) || ('partner' in b ? 1 : 0) - ('partner' in a ? 1 : 0));

        const [isSolved, solvedBoards] = solve(allSolvedBoards, sortedAllUnits);
        
        if (!isSolved) {
            return currentTimetables.map(t => ({
                ...t,
                error: "Failed to generate a valid timetable. Check for teacher over-allocation or conflicting constraints.",
                timetable: {}, classes: [], conflicts: []
            }));
        }

        let newTimetables = [...currentTimetables];
        for (const schoolId in solvedBoards) {
            const board = solvedBoards[schoolId];
            for (const day in board) {
                board[day] = board[day].filter(slot => slot && slot.length > 0);
                board[day].sort((a: TimetableSession[], b: TimetableSession[]) => (a[0]?.period || 0) - (b[0]?.period || 0));
            }
            const schoolIndex = newTimetables.findIndex(t => t.id === schoolId);
            if (schoolIndex !== -1) {
                newTimetables[schoolIndex] = {
                    ...newTimetables[schoolIndex],
                    timetable: board,
                    classes: Array.from(allClassSets[schoolId] || []).sort(),
                    conflicts: [],
                    error: null,
                };
            }
        }
        
        for (const schoolId in solvedBoards) {
            const updatedTT = newTimetables.find(t => t.id === schoolId);
            if (updatedTT) {
                findConflicts(schoolId, updatedTT.timetable);
            }
        }
        
        return newTimetables;

    });
  };


  const clearTimetable = () => {
    resetAllTimetables();
  }
  
  const moveSession = (
    session: TimetableSession,
    from: { day: string; period: number },
    to: { day: string; period: number }
  ) => {
    setTimetables(prevTimetables => {
      const newTimetables = JSON.parse(JSON.stringify(prevTimetables));
      const schoolIndex = newTimetables.findIndex((t: Timetable) => t.id === session.schoolId);
      
      if (schoolIndex === -1) return prevTimetables;

      const newTimetableData = newTimetables[schoolIndex].timetable;

      // Remove from 'from' slot
      const fromSlotArr = newTimetableData[from.day];
      if (fromSlotArr) {
        const fromSlotIndex = fromSlotArr.findIndex((s: TimetableSession[]) => s[0]?.period === from.period);
        if (fromSlotIndex > -1) {
          const sessionIndex = fromSlotArr[fromSlotIndex].findIndex((s: TimetableSession) => s.id === session.id && s.className === session.className && s.part === session.part);
          if (sessionIndex > -1) {
            fromSlotArr[fromSlotIndex].splice(sessionIndex, 1);
            if (fromSlotArr[fromSlotIndex].length === 0) {
              fromSlotArr.splice(fromSlotIndex, 1);
            }
          }
        }
      }

      // Add to 'to' slot
      let toSlot = newTimetableData[to.day]?.find((s: TimetableSession[]) => s[0]?.period === to.period);
      const newSession = { ...session, day: to.day, period: to.period };

      if (toSlot) {
        toSlot.push(newSession);
      } else {
        if (!newTimetableData[to.day]) newTimetableData[to.day] = [];
        newTimetableData[to.day].push([newSession]);
        newTimetableData[to.day].sort((a: TimetableSession[], b: TimetableSession[]) => (a[0]?.period || 0) - (b[0]?.period || 0));
      }
      
      newTimetables[schoolIndex] = { ...newTimetables[schoolIndex], timetable: newTimetableData };
      findConflicts(session.schoolId, newTimetableData);
      
      return newTimetables;
    });
  };

  const resolveConflicts = () => {
    clearTimetable();
  };

  const isConflict = (sessionId: string): boolean => {
    if (!activeTimetable || !activeTimetable.conflicts) return false;
    return activeTimetable.conflicts.some(c => c.id === sessionId || sessionId.startsWith(c.id));
  };
  
  const filteredLockedSessions = useMemo(() => {
    if (!activeTimetable?.lockedSessions) return [];
    return activeTimetable.lockedSessions.filter(s => s.day !== 'all_week');
  }, [activeTimetable?.lockedSessions]);

  const classes = useMemo(() => activeTimetable?.classes || [], [activeTimetable]);
  
  const arms = useMemo(() => {
    if (!activeTimetable) return [];

    const armSet = new Set<string>();
    
    allTeachers.forEach(teacher => {
        teacher.assignments.forEach(assignment => {
            if (assignment.schoolId !== activeTimetable.id || !assignment.arms || assignment.arms.length === 0) return;
            
            assignment.grades.forEach(grade => {
                assignment.arms.forEach(arm => {
                    const fullClassName = `${grade} ${arm}`;
                    armSet.add(fullClassName);
                });
            });
        });
    });

    const sortedArms = Array.from(armSet).sort();
    if (sortedArms.length > 0) return sortedArms;

    return classes.sort();
  }, [activeTimetable, classes, allTeachers]);


  return (
    <TimetableContext.Provider
      value={{
        timetables,
        activeTimetable: activeTimetable ? { ...activeTimetable, lockedSessions: filteredLockedSessions } : null,
        activeTimetableId,
        allTeachers,
        addTimetable,
        removeTimetable,
        renameTimetable,
        setActiveTimetableId,
        addTeacher,
        removeTeacher,
        updateTeacher,
        isTeacherEditorOpen,
        setIsTeacherEditorOpen,
        editingTeacher,
        setEditingTeacher,
        addLockedSession,
        removeLockedSession,
        generateTimetable,
        clearTimetable,
        moveSession,
        isConflict,
        viewMode,
        setViewMode,
        resolveConflicts,
        updateTimeSlots,
        classes,
        arms
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

    

    

    
