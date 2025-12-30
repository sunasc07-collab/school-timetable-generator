
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

interface MobileTimetableViewProps {
    itemsToRender: { title: string; filterValue: string }[];
}

export default function MobileTimetableView({ itemsToRender }: MobileTimetableViewProps) {
    const { activeTimetable, viewMode } = useTimetable();
    const { timetable, days, timeSlots } = activeTimetable || {};

    if (!timetable || !days || !timeSlots) {
        return null;
    }
    
    const periodSlots = timeSlots.filter(slot => !slot.isBreak);

    return (
        <Accordion type="multiple" className="w-full space-y-4">
        {itemsToRender.map(({ title, filterValue }) => (
            <AccordionItem value={filterValue} key={filterValue} className="border rounded-lg">
                <AccordionTrigger className="p-4 font-headline text-lg hover:no-underline">
                   {title}
                </AccordionTrigger>
                <AccordionContent className="p-0">
                    <div className="flex flex-col">
                        {days.map(day => (
                            <div key={day} className="flex flex-col p-4 border-t">
                                <h3 className="font-bold text-base mb-2">{day}</h3>
                                {periodSlots.map((slot, periodIndex) => {
                                    const allSessionsInSlot = timetable[day]?.[periodIndex] || [];
                                    
                                    let relevantSessions = [];
                                    if (viewMode === 'class' || viewMode === 'arm') {
                                        relevantSessions = allSessionsInSlot.filter(s => s.classes.includes(filterValue));
                                    } else if (viewMode === 'teacher') {
                                        relevantSessions = allSessionsInSlot.filter(s => s.teacherId === filterValue);
                                    }

                                    if (relevantSessions.length === 0) return null;

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
                                                {relevantSessions.map((session, sIndex) => (
                                                    <TimetableItem 
                                                        key={`${session.id}-${sIndex}`}
                                                        session={session}
                                                        from={{ day, period: periodIndex }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </AccordionContent>
            </AccordionItem>
        ))}
        </Accordion>
    );
}
