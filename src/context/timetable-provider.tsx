
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
    { period: 1, time: '08:00-08:40', id: crypto.randomUUID() },
    { period: 2, time: '08:40-09:20', id: crypto.randomUUID() },
    { period: 3, time: '09:20-10:00', id: crypto.randomUUID() },
    { period: null, time: '10:00-10:20', isBreak: true, label: 'Short Break', id: crypto.randomUUID(), days: DEFAULT_DAYS },
    { period: 4, time: '10:20-11:00', id: crypto.randomUUID() },
    { period: 5, time: '11:00-11:40', id: crypto.randomUUID() },
    { period: 6, time: '11:40-12:20', id: crypto.randomUUID() },
    { period: null, time: '12:20-13:00', isBreak: true, label: 'Lunch', id: crypto.randomUUID(), days: DEFAULT_DAYS },
    { period: 7, time: '13:00-13:40', id: crypto.randomUUID() },
    { period: 8, time: '13:40-14:20', id: crypto.randomUUID() },
    { period: 9, time: '14:20-15:00', id: crypto.randomUUID() },
    { period: 10, time: '15:00-15:40', id: crypto.randomUUID() },
    { period: 11, time: '15:40-16:20', id: crypto.randomUUID() },
    { period: 12, time: '16:20-17:00', id: crypto.randomUUID() },
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
    return {
        id: id || crypto.randomUUID(),
        name,
        timetable: {},
        classes: [],
        conflicts: [],
        days: DEFAULT_DAYS,
        timeSlots: JSON.parse(JSON.stringify(DEFAULT_TIMESLOTS)),
        error: null,
        lockedSessions: [],
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

  const findConflicts = useCallback((timetableId: string) => {
    const currentTT = timetables.find(t => t.id === timetableId);
    if (!currentTT || !currentTT.timetable || Object.keys(currentTT.timetable).length === 0) {
        if(currentTT) updateTimetable(timetableId, { conflicts: [] });
        return;
    }
    
    const { days, timetable: timetableData } = currentTT;
    const newConflicts: Conflict[] = [];

    days.forEach(day => {
        const daySlots = timetableData[day] || [];
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
                 if(nonLockedSessions.length <= 1) return;

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

    updateTimetable(timetableId, { conflicts: newConflicts });
  }, [updateTimetable, timetables]);
  
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
      setAllTeachers(prev => {
          return prev.map(teacher => ({
              ...teacher,
              assignments: teacher.assignments.filter(a => a.schoolId !== timetableId)
          })).filter(teacher => teacher.assignments.length > 0);
      });
      setTimetables(prev => {
          const newTimetables = prev.filter(t => t.id !== timetableId);
          if (activeTimetableId === timetableId) {
              setActiveTimetableId(newTimetables[0]?.id || null);
          }
          return newTimetables;
      });
  }
  
  const renameTimetable = (timetableId: string, newName: string) => {
      updateTimetable(timetableId, { name: newName });
  }

  const addTeacher = useCallback((teacherData: Teacher) => {
    const newTeacher = { ...teacherData, id: teacherData.id || crypto.randomUUID() };
    setAllTeachers(prev => [...prev, newTeacher]);
    resetAllTimetables();
  }, [setAllTeachers, resetAllTimetables]);
  
  const updateTeacher = useCallback((teacherData: Teacher) => {
      setAllTeachers(prev => prev.map(t => t.id === teacherData.id ? teacherData : t));
      resetAllTimetables();
  }, [setAllTeachers, resetAllTimetables]);

  const removeTeacher = useCallback((teacherId: string) => {
    setAllTeachers(prev => prev.filter(t => t.id !== teacherId));
    resetAllTimetables();
  }, [setAllTeachers, resetAllTimetables]);

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

      const id = crypto.randomUUID();
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
  
  const generateTimetable = useCallback(() => {
    
    let allSolvedBoards: { [schoolId: string]: TimetableData } = {};
    
    timetables.forEach(tt => {
        allSolvedBoards[tt.id] = {};
        tt.days.forEach(day => {
            allSolvedBoards[tt.id][day] = [];
        });
        (tt.lockedSessions || []).filter(ls => ls.day !== 'all_week').forEach(ls => {
            const classNames = ls.className === 'all' ? (tt.classes || []) : [ls.className];
            const lockedSlot: TimetableSession[] = [{
                id: ls.id, subject: ls.activity, className: ls.className, classes: classNames, teacher: '', isLocked: true, isDouble: false, period: ls.period, schoolId: tt.id
            }];
            
            let slot = allSolvedBoards[tt.id][ls.day].find(s => s[0]?.period === ls.period);
            if(slot) {
                slot.push(...lockedSlot);
            } else {
                allSolvedBoards[tt.id][ls.day].push(lockedSlot);
            }
        });
    });

    const allCurrentSchoolAssignments = allTeachers.flatMap(teacher => 
        teacher.assignments
            .map(a => ({ ...a, teacherId: teacher.id, teacherName: teacher.name }))
    );
    
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
            const schoolTimetable = timetables.find(t => t.id === session.schoolId);
            if (!schoolTimetable) return false;
            
            const assignment = allCurrentSchoolAssignments.find(a => 
                a.teacherId === session.teacherId &&
                a.schoolId === session.schoolId &&
                a.subject === (session.actualSubject || session.subject) &&
                a.grades.some(g => session.classes.some(c => c.startsWith(g)))
            );
            if (assignment && assignment.days && assignment.days.length > 0 && !assignment.days.includes(day)) {
                return false;
            }

            const targetSlotInBoard = boards[session.schoolId]?.[day]?.find(slot => slot[0]?.period === p);

            if (targetSlotInBoard) {
                if (targetSlotInBoard.some(s => s.isLocked && (s.classes.some(c => session.classes.includes(c)) || s.className === 'all'))) {
                     return false;
                }
                if (targetSlotInBoard.some(s => s.classes.some(c => session.classes.includes(c)))) {
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
                    const otherSchoolConfig = timetables.find(t => t.id === schoolId);
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

        const schoolForUnit = timetables.find(t => t.id === (('sessions' in unit) ? unit.sessions[0].schoolId : ('session' in unit ? unit.session.schoolId : unit.schoolId)));
        if (!schoolForUnit) return false;

        if ('partner' in unit) { // Double Period
            const teachingPeriodsForDay = schoolForUnit.timeSlots
                .filter(ts => !ts.isBreak || !(ts.days || schoolForUnit.days).includes(day))
                .map(ts => ts.period).filter((p): p is number => p !== null).sort((a,b) => a-b);
            
            const periodSlotIndex = teachingPeriodsForDay.indexOf(period);
            if (periodSlotIndex === -1 || periodSlotIndex + 1 >= teachingPeriodsForDay.length) return false;
            
            const nextTeachingPeriod = teachingPeriodsForDay[periodSlotIndex + 1];

            const periodSlotObj = schoolForUnit.timeSlots.find(p => p.period === period);
            const nextPeriodSlotObj = schoolForUnit.timeSlots.find(p => p.period === nextTeachingPeriod);
            if (!periodSlotObj || !nextPeriodSlotObj) return false;
            
            const timeSlotIndex = schoolForUnit.timeSlots.findIndex(p => p.id === periodSlotObj.id);
            const nextTimeSlotIndex = schoolForUnit.timeSlots.findIndex(p => p.id === nextPeriodSlotObj.id);

            if(timeSlotIndex + 1 !== nextTimeSlotIndex) return false;

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
        
        const schoolForUnit = timetables.find(t => t.id === (('sessions' in unit) ? unit.sessions[0].schoolId : ('session' in unit ? unit.session.schoolId : unit.schoolId)));
        if (!schoolForUnit) return solve(boards, remainingUnits);


        for (const day of schoolForUnit.days) {
            const schoolPeriods = (schoolForUnit.timeSlots || [])
                .filter(ts => !ts.isBreak || !(ts.days || schoolForUnit.days).includes(day))
                .map(ts => ts.period)
                .filter((p): p is number => p !== null);

            for (const period of schoolPeriods) {
                if (isValidPlacement(boards, unit, day, period)) {
                   const newBoards = JSON.parse(JSON.stringify(boards));
                   
                   const placeSession = (session: TimetableSession, p: number) => {
                       let slot = newBoards[session.schoolId][day].find((s: TimetableSession[]) => s[0]?.period === p);
                       if (slot) {
                           slot.push({ ...session, period: p });
                       } else {
                           newBoards[session.schoolId][day].push([{ ...session, period: p }]);
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
    const allClassSets: {[schoolId: string]: Set<string>} = {};
    
    timetables.forEach(tt => {
        allClassSets[tt.id] = new Set<string>();
    });
    
    const primaryAssignments = allCurrentSchoolAssignments.filter(a => !timetables.find(t => t.id === a.schoolId)?.name.toLowerCase().includes('secondary'));
    const secondaryCoreAssignments = allCurrentSchoolAssignments.filter(a => timetables.find(t => t.id === a.schoolId)?.name.toLowerCase().includes('secondary') && a.subjectType === 'core');
    const secondaryOptionalAssignments = allCurrentSchoolAssignments.filter(a => timetables.find(t => t.id === a.schoolId)?.name.toLowerCase().includes('secondary') && a.subjectType === 'optional');

    primaryAssignments.forEach(assignment => {
        assignment.grades.forEach(grade => {
            const className = grade;
            allClassSets[assignment.schoolId]?.add(className);
            for (let i = 0; i < assignment.periods; i++) {
                allUnits.push({
                    id: crypto.randomUUID(), subject: assignment.subject, teacher: assignment.teacherName!, teacherId: assignment.teacherId!, className, classes: [className], isDouble: false, period: 0, schoolId: assignment.schoolId, actualSubject: assignment.subject
                });
            }
        });
    });

    secondaryCoreAssignments.forEach(assignment => {
        assignment.grades.forEach(grade => {
            (assignment.arms || ['']).forEach(arm => {
                const className = `${grade} ${arm}`.trim();
                allClassSets[assignment.schoolId]?.add(className);
                for (let i = 0; i < assignment.periods; i++) {
                    allUnits.push({
                        id: crypto.randomUUID(), subject: assignment.subject, teacher: assignment.teacherName!, teacherId: assignment.teacherId!, className, classes: [className], isDouble: false, period: 0, schoolId: assignment.schoolId, actualSubject: assignment.subject
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

        classNamesForBlock.forEach(cn => allClassSets[schoolId]?.add(cn));
        
        for (let i = 0; i < periods; i++) {
            const blockId = crypto.randomUUID();
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
        setTimetables(prev => prev.map(t => ({
            ...t,
            error: "Failed to generate a valid timetable. Check for teacher over-allocation or conflicting constraints.",
            timetable: {}, classes: [], conflicts: []
        })));
        return;
    }

    for (const schoolId in solvedBoards) {
        const board = solvedBoards[schoolId];
        for (const day in board) {
            board[day].sort((a: TimetableSession[], b: TimetableSession[]) => (a[0]?.period || 0) - (b[0]?.period || 0));
        }
        updateTimetable(schoolId, { 
            timetable: board,
            classes: Array.from(allClassSets[schoolId] || []).sort(),
            conflicts: [],
            error: null,
        });
        findConflicts(schoolId);
    }

  }, [updateTimetable, allTeachers, findConflicts, timetables]);


  const clearTimetable = () => {
    resetAllTimetables();
  }
  
  const moveSession = (
    session: TimetableSession, 
    from: { day: string; period: number },
    to: { day: string; period: number }
  ) => {
    const schoolTimetable = timetables.find(t => t.id === session.schoolId);
    if (!schoolTimetable?.timetable) return;

    const newTimetableData = JSON.parse(JSON.stringify(schoolTimetable.timetable));
    
    const fromSlotArr = newTimetableData[from.day];
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

    let toSlot = newTimetableData[to.day]?.find((s: TimetableSession[]) => s[0]?.period === to.period);
    if (toSlot) {
        toSlot.push({ ...session, period: to.period });
    } else {
        if (!newTimetableData[to.day]) newTimetableData[to.day] = [];
        newTimetableData[to.day].push([{ ...session, period: to.period }]);
        newTimetableData[to.day].sort((a: TimetableSession[], b: TimetableSession[]) => (a[0]?.period || 0) - (b[0]?.period || 0));
    }
    
    updateTimetable(session.schoolId, { timetable: newTimetableData });
    findConflicts(session.schoolId);
  }

  const resolveConflicts = () => {
    if (!activeTimetable) return;
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
