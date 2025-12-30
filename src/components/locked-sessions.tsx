
"use client";

import { useTimetable } from "@/context/timetable-provider";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { ScrollArea } from "./ui/scroll-area";
import { Lock, Plus, Trash2 } from "lucide-react";
import type { LockedSession } from "@/lib/types";

const lockedSessionSchema = z.object({
    activity: z.string().min(1, "Activity is required"),
    day: z.string().min(1, "Day is required"),
    period: z.coerce.number().min(1, "Period is required"),
    className: z.string().min(1, "Class is required"),
});

type LockedSessionFormValues = z.infer<typeof lockedSessionSchema>;

const ACTIVITIES = ["Assembly", "Sports", "Club Activities", "Guidance"];

export default function LockedSessions() {
    const { activeTimetable, addLockedSession, removeLockedSession } = useTimetable();

    const form = useForm<LockedSessionFormValues>({
        resolver: zodResolver(lockedSessionSchema),
        defaultValues: {
            activity: "",
            day: "",
            period: undefined,
            className: "",
        }
    });

    if (!activeTimetable) return null;

    const { days, timeSlots, classes, lockedSessions } = activeTimetable;
    const teachingPeriods = timeSlots.filter(ts => !ts.isBreak);

    const onSubmit = (data: LockedSessionFormValues) => {
        addLockedSession(data);
        form.reset();
    };

    const classOptions = ["all", ...classes];
    const dayOptions = ["all_week", ...days];

    return (
        <div className="p-2 space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground px-2 flex items-center"><Lock className="mr-2 h-4 w-4" />Locked Periods</h3>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-2 border rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="activity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Activity</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select Activity..." /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {ACTIVITIES.map(act => <SelectItem key={act} value={act}>{act}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="className"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Class</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select Class..." /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                             {classOptions.map(c => <SelectItem key={c} value={c}>{c === 'all' ? 'All Classes' : c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                         <FormField
                            control={form.control}
                            name="day"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Day</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select Day..." /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {dayOptions.map(d => <SelectItem key={d} value={d}>{d === 'all_week' ? 'All Week' : d}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="period"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Period</FormLabel>
                                    <Select onValueChange={field.onChange} value={String(field.value)}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select Period..." /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {teachingPeriods.map(p => <SelectItem key={p.id} value={String(p.period)}>{`Period ${p.period} (${p.time})`}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <Button type="submit" size="sm" className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Locked Period
                    </Button>
                </form>
            </Form>

            <ScrollArea className="h-48">
                <div className="space-y-2 pr-4">
                {lockedSessions.map((ls) => (
                    <div key={ls.id} className="flex items-center justify-between p-2 border rounded-md text-sm">
                        <div>
                            <p className="font-semibold">{ls.activity}</p>
                            <p className="text-xs text-muted-foreground">
                                {ls.day === 'all_week' ? `All Week, Period ${ls.period}` : `${ls.day}, Period ${ls.period}`} ({ls.className === 'all' ? 'All Classes' : ls.className})
                            </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLockedSession(ls.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
                 {lockedSessions.length === 0 && (
                    <p className="text-xs text-center text-muted-foreground p-4">No locked periods added.</p>
                 )}
                </div>
            </ScrollArea>
        </div>
    );
}
