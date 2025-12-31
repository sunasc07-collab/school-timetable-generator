
"use client";

import { useTimetable } from "@/context/timetable-provider";
import TimetableItem from "./timetable-item";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "./ui/separator";
import { formatTime } from "@/lib/utils";
import type { TimetableSession } from "@/lib/types";

interface MobileTimetableViewProps {
    itemsToRender: { 
        title: string; 
        filterValue: string;
        // For teacher view, these will be consolidated sessions from multiple schools
        allTeacherSessions?: TimetableSession[];
    }[];
}

export default function MobileTimetableView({ itemsToRender }: MobileTimetableViewProps) {
    const { activeTimetable, viewMode, timetables } = useTimetable();

    if (!activeTimetable) return null;

    // For class/arm view, we use the active timetable.
    // For teacher view, the structure comes from the first relevant timetable.
    const getTemplateTimetable = (filterValue: string) => {
        if (viewMode === 'class' || viewMode === 'arm') {
            return activeTimetable;
        }
        if (viewMode === 'teacher') {
            const firstTimetableForTeacher = timetables.find(t => 
                t.timetable && Object.keys(t.timetable).length > 0 &&
                Object.values(t.timetable).flat().flat().some(s => s.teacherId === filterValue)
            );
            return firstTimetableForTeacher || activeTimetable;
        }
        return activeTimetable;
    }

    return (
        <Accordion type="multiple" className="w-full space-y-4">
        {itemsToRender.map(({ title, filterValue, allTeacherSessions }) => {
            const templateTimetable = getTemplateTimetable(filterValue);
            if (!templateTimetable) return null;

            const { timetable, days, timeSlots } = templateTimetable;
            const periodSlots = timeSlots.filter(slot => !slot.isBreak);

            return (
                <AccordionItem value={filterValue} key={filterValue} className="border rounded-lg">
                    <AccordionTrigger className="p-4 font-headline text-lg hover:no-underline">
                       {title}
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                        <div className="flex flex-col">
                            {days.map(day => (
                                <div key={day} className="flex flex-col p-4 border-t">
                                    <h3 className="font-bold text-base mb-2">{day}</h3>
                                    {periodSlots.map((slot) => {
                                        if (slot.period === null) return null;
                                        
                                        let relevantSessions: TimetableSession[] = [];
                                        if (viewMode === 'teacher' && allTeacherSessions) {
                                            relevantSessions = allTeacherSessions.filter(s => s.day === day && s.period === slot.period);
                                        } else if (timetable) {
                                            const allSessionsInSlot = timetable[day]?.find(s => s[0]?.period === slot.period) || [];
                                            if (viewMode === 'class' || viewMode === 'arm') {
                                                relevantSessions = allSessionsInSlot.filter(s => s.classes.includes(filterValue));
                                            }
                                        }

                                        const [start, end] = slot.time.split('-');
                                        const formattedTime = `${formatTime(start)} - ${formatTime(end)}`;

                                        return (
                                            <div key={slot.period} className="mb-2">
                                                <div className="flex items-baseline gap-4 mb-1">
                                                    <p className="text-sm font-semibold text-muted-foreground min-w-[80px]">{formattedTime}</p>
                                                    <Separator orientation="vertical" className="h-4" />
                                                    <p className="text-xs text-muted-foreground">Period {slot.period}</p>
                                                </div>
                                                 <div className="pl-2 border-l-2 ml-4 pl-4 space-y-2">
                                                    {relevantSessions.length > 0 ? relevantSessions.map((session, sIndex) => (
                                                        <TimetableItem 
                                                            key={`${session.id}-${sIndex}`}
                                                            session={session}
                                                            from={{ day, period: slot.period as number }}
                                                        />
                                                    )) : <div className="h-10"></div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            );
        })}
        </Accordion>
    );
}
