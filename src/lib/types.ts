

export type SubjectAssignment = {
    id: string;
    grades: string[];
    arms: string[];
    periods: number;
};

export type Subject = {
  id: string;
  name: string;
  assignments: SubjectAssignment[];
};

export type Teacher = {
  id: string;
  name: string;
  subjects: Subject[];
};

export type TimetableSession = {
  id: string;
  subject: string;
  className: string;
  teacher: string;
  isDouble: boolean;
  part?: 1 | 2;
};

export type TimetableData = {
  [day: string]: (TimetableSession | null)[];
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
  period: number | null;
  time: string;
  isBreak?: boolean;
  label?: string;
};

    