export type Subject = {
  id: string;
  name: string;
  className: string;
  periods: number;
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
  type: "teacher";
  message: string;
};

export type TimeSlot = {
  period: number | null;
  time: string;
  isBreak?: boolean;
  label?: string;
};
