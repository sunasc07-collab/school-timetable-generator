

export type SubjectAssignment = {
  id: string;
  grades: string[];
  subject: string;
  arms: string[];
  periods: number;
  schoolId: string;
  isCore?: boolean;
  optionGroup?: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  subjectType?: 'core' | 'optional';
  teacherId?: string; // For internal processing
  teacherName?: string; // For internal processing
};

export type Teacher = {
  id: string;
  name: string;
  assignments: SubjectAssignment[];
};

export type TimetableSession = {
  id: string;
  subject: string;
  actualSubject?: string;
  className: string;
  teacher: string;
  teacherId?: string; // Add teacherId
  isDouble: boolean;
  part?: 1 | 2;
  classes: string[]; 
  isCore?: boolean;
  optionGroup?: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  isLocked?: boolean;
  period: number;
};

export type TimetableSlot = TimetableSession[];

export type TimetableData = {
  [day: string]: TimetableSlot[];
};

export type TimetableDragData = {
  session: TimetableSession;
  from: {
    day: string;
    period: number;
  };
};

export type Conflict = {
  id: string;
  type: "teacher" | "class";
  message: string;
};

export type TimeSlot = {
  id: string;
  period: number | null;
  time: string;
  isBreak?: boolean;
  label?: string;
  days?: string[];
};

export type ViewMode = 'class' | 'teacher' | 'arm';

export type LockedSession = {
  id:string;
  schoolId: string;
  day: string; // can be a specific day or 'all_week' for the master record
  period: number;
  activity: string;
  className: string; // can be 'all'
  isWeekly?: boolean;
  weeklyId?: string;
};

export type Timetable = {
  id: string;
  name: string;
  timetable: TimetableData;
  classes: string[];
  conflicts: Conflict[];
  days: string[];
  timeSlots: TimeSlot[];
  error: string | null;
  lockedSessions: LockedSession[];
};
