
"use client";

import { useTimetable } from "@/context/timetable-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { GripVertical, Plus, Trash2, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import type { TimeSlot, LockedSession } from "@/lib/types";
import { Checkbox } from "./ui/checkbox";
import { to12Hour, to24Hour, formatTime } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { ScrollArea } from "./ui/scroll-area";


interface SystemSettingsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const lockedSessionSchema = z.object({
    activity: z.string().min(1, "Activity is required"),
    day: z.string().min(1, "Day is required"),
    period: z.coerce.number({ invalid_type_error: "Period is required" }),
    className: z.string().min(1, "Class is required"),
    allWeek: z.boolean().default(false),
});

type LockedSessionFormValues = z.infer<typeof lockedSessionSchema>;

function LockedSessionsTab() {
    const { activeTimetable, addLockedSession, removeLockedSession, classes } = useTimetable();

    const form = useForm<LockedSessionFormValues>({
        resolver: zodResolver(lockedSessionSchema),
        defaultValues: {
            activity: "",
            day: "",
            className: "",
            allWeek: false,
        }
    });

    if (!activeTimetable) return null;

    const { days, timeSlots, lockedSessions } = activeTimetable;

    const onSubmit = (data: LockedSessionFormValues) => {
        addLockedSession({
            ...data,
            day: data.allWeek ? 'all_week' : data.day,
        });
        form.reset({
            activity: "",
            day: "",
            className: "",
            allWeek: false,
        });
    };

    const classOptions = ["all", ...classes];
    const teachingPeriods = timeSlots.filter(p => !p.isBreak);

    return (
        <div className="space-y-4 py-4">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-lg">
                     <h3 className="text-base font-medium text-foreground flex items-center"><Lock className="mr-2 h-4 w-4" />Add New Locked Period</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="activity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Activity</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Assembly" {...field} />
                                    </FormControl>
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
                                    <Select onValueChange={field.onChange} value={field.value} disabled={form.watch('allWeek')}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select Day..." /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
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
                                            {teachingPeriods.map(p => {
                                                if (!p.period) return null;
                                                const [start, end] = p.time.split('-');
                                                return (
                                                    <SelectItem key={p.id} value={String(p.period)}>
                                                        {`Period ${p.period} (${formatTime(start)}-${formatTime(end)})`}
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="allWeek"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-2">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={(checked) => {
                                            const isChecked = !!checked;
                                            field.onChange(isChecked);
                                            if (isChecked) {
                                                form.setValue('day', 'all_week');
                                                form.clearErrors('day');
                                            } else {
                                                 form.setValue('day', '');
                                            }
                                        }}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal text-sm">
                                    Apply to all week
                                </FormLabel>
                            </FormItem>
                        )}
                    />
                    <Button type="submit" size="sm" className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Locked Period
                    </Button>
                </form>
            </Form>

            <div className="space-y-2 pt-4">
                <h3 className="text-base font-medium text-foreground px-2">Current Locked Periods</h3>
                 <ScrollArea className="h-48 border rounded-md p-2">
                    <div className="space-y-2 pr-2">
                    {lockedSessions.map((ls) => (
                        <div key={ls.id} className="flex items-center justify-between p-2 border rounded-md text-sm bg-muted/50">
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
        </div>
    );
}


function TimeSlotsTab({ onSaveChanges }: { onSaveChanges: () => void }) {
    const { activeTimetable, updateTimeSlots } = useTimetable();
    const [localTimeSlots, setLocalTimeSlots] = useState<TimeSlot[]>([]);
    const [draggedItem, setDraggedItem] = useState<TimeSlot | null>(null);

     useEffect(() => {
        if (activeTimetable) {
            // Deep copy to avoid modifying the original state directly
            setLocalTimeSlots(JSON.parse(JSON.stringify(activeTimetable.timeSlots)));
        }
    }, [activeTimetable]);
    
    const handleTimeSlotChange = (index: number, field: keyof TimeSlot, value: any) => {
        const newTimeSlots = [...localTimeSlots];
        // @ts-ignore
        newTimeSlots[index][field] = value;
        setLocalTimeSlots(newTimeSlots);
    };

    const handleTimeValueChange = (index: number, part: 'start' | 'end', value: string) => {
        const newTimeSlots = [...localTimeSlots];
        const [start, end] = newTimeSlots[index].time.split('-');
        let newTime;
        if (part === 'start') {
            newTime = `${value}-${end}`;
        } else {
            newTime = `${start}-${value}`;
        }
        newTimeSlots[index].time = newTime;
        setLocalTimeSlots(newTimeSlots);
    };
    
    const handleDayToggle = (index: number, day: string) => {
        if (!activeTimetable) return;
        const newTimeSlots = [...localTimeSlots];
        const slot = newTimeSlots[index];
        const currentDays = slot.days || activeTimetable?.days || [];
        const newDays = currentDays.includes(day)
            ? currentDays.filter(d => d !== day)
            : [...currentDays, day];
        
        handleTimeSlotChange(index, 'days', newDays);
    }

    const handleAddSlot = (index: number, isBreak: boolean) => {
        const newSlot: TimeSlot = {
            id: crypto.randomUUID(),
            period: null,
            time: '00:00-00:00',
            isBreak: isBreak,
            label: isBreak ? 'Short Break' : '',
            days: isBreak ? (activeTimetable?.days || []) : undefined
        };
        const newTimeSlots = [...localTimeSlots];
        newTimeSlots.splice(index + 1, 0, newSlot);
        setLocalTimeSlots(newTimeSlots);
    };

    const handleRemoveSlot = (index: number) => {
        const newTimeSlots = localTimeSlots.filter((_, i) => i !== index);
        setLocalTimeSlots(newTimeSlots);
    };

    const handleSaveTimeSlots = () => {
        if (!activeTimetable) return;
        updateTimeSlots(localTimeSlots);
        onSaveChanges();
    }
    
    const onDragStart = (e: React.DragEvent<HTMLDivElement>, item: TimeSlot) => {
        setDraggedItem(item);
    };

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>, targetItem: TimeSlot) => {
        if (!draggedItem) return;

        const currentIndex = localTimeSlots.findIndex(item => item.id === draggedItem.id);
        const targetIndex = localTimeSlots.findIndex(item => item.id === targetItem.id);

        if (currentIndex !== -1 && targetIndex !== -1) {
            const newTimeSlots = [...localTimeSlots];
            const [removed] = newTimeSlots.splice(currentIndex, 1);
            newTimeSlots.splice(targetIndex, 0, removed);
            setLocalTimeSlots(newTimeSlots);
        }
        setDraggedItem(null);
    };

    return (
      <>
        <div className="py-4">
          {localTimeSlots.map((slot, index) => {
              const [start, end] = slot.time.split('-');
              const { time: startTime12, ampm: startAmPm } = to12Hour(start);
              const { time: endTime12, ampm: endAmPm } = to12Hour(end);

              return (
                  <div 
                      key={slot.id} 
                      className="grid grid-cols-1 items-end gap-3 p-3 mb-4 border rounded-lg relative group"
                      draggable
                      onDragStart={(e) => onDragStart(e, slot)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, slot)}
                  >
                      <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] items-end gap-3">
                          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                          
                          <div className="space-y-1">
                              <Label htmlFor={`time-start-${index}`}>Start Time</Label>
                              <div className="flex gap-1">
                                  <Input
                                      id={`time-start-${index}`}
                                      value={startTime12}
                                      onChange={(e) => {
                                          const new24h = to24Hour(e.target.value, startAmPm);
                                          handleTimeValueChange(index, 'start', new24h);
                                      }}
                                      placeholder="e.g., 08:00"
                                  />
                                  <Select
                                    value={startAmPm}
                                    onValueChange={(ampm) => {
                                      const new24h = to24Hour(startTime12, ampm as 'am' | 'pm');
                                      handleTimeValueChange(index, 'start', new24h);
                                    }}
                                  >
                                    <SelectTrigger className="w-20"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="am">AM</SelectItem>
                                      <SelectItem value="pm">PM</SelectItem>
                                    </SelectContent>
                                  </Select>
                              </div>
                          </div>
                           <div className="space-y-1">
                              <Label htmlFor={`time-end-${index}`}>End Time</Label>
                              <div className="flex gap-1">
                                  <Input
                                      id={`time-end-${index}`}
                                      value={endTime12}
                                      onChange={(e) => {
                                          const new24h = to24Hour(e.target.value, endAmPm);
                                          handleTimeValueChange(index, 'end', new24h);
                                      }}
                                      placeholder="e.g., 08:40"
                                  />
                                  <Select
                                    value={endAmPm}
                                    onValueChange={(ampm) => {
                                      const new24h = to24Hour(endTime12, ampm as 'am' | 'pm');
                                      handleTimeValueChange(index, 'end', new24h);
                                    }}
                                  >
                                    <SelectTrigger className="w-20"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="am">AM</SelectItem>
                                      <SelectItem value="pm">PM</SelectItem>
                                    </SelectContent>
                                  </Select>
                              </div>
                          </div>
                          <div className="space-y-1">
                                <Label htmlFor={`label-${index}`}>Activity</Label>
                                <Input
                                    id={`label-${index}`}
                                    value={slot.label || ''}
                                    onChange={(e) => handleTimeSlotChange(index, 'label', e.target.value)}
                                    disabled={!slot.isBreak}
                                    placeholder="Break Activity"
                                />
                            </div>
                          <div className="flex flex-col items-center space-y-2">
                              <Label htmlFor={`isBreak-${index}`} className="text-xs">Break</Label>
                              <Switch
                                  id={`isBreak-${index}`}
                                  checked={slot.isBreak}
                                  onCheckedChange={(checked) => {
                                      handleTimeSlotChange(index, 'isBreak', checked)
                                      if (checked) {
                                          handleTimeSlotChange(index, 'label', 'Short Break')
                                          handleTimeSlotChange(index, 'days', activeTimetable?.days || [])
                                      } else {
                                          handleTimeSlotChange(index, 'label', '')
                                          handleTimeSlotChange(index, 'days', undefined)
                                      }
                                  }}
                              />
                          </div>

                          <div className="flex flex-col gap-2">
                              <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="sm" className="h-8">
                                          <Plus className="mr-2 h-4 w-4" />
                                          Add
                                      </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                      <DropdownMenuItem onSelect={() => handleAddSlot(index, false)}>
                                          Add Period
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onSelect={() => handleAddSlot(index, true)}>
                                          Add Special Period
                                      </DropdownMenuItem>
                                  </DropdownMenuContent>
                              </DropdownMenu>
                              <Button variant="destructive" size="sm" className="h-8" onClick={() => handleRemoveSlot(index)} disabled={localTimeSlots.length <= 1}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove
                              </Button>
                          </div>
                      </div>
                      {slot.isBreak && activeTimetable?.days && (
                          <div className="mt-2 pl-8">
                              <Label className="text-xs text-muted-foreground">Apply break to specific days:</Label>
                              <div className="flex items-center gap-4 mt-1">
                                  {activeTimetable.days.map(day => (
                                      <div key={day} className="flex items-center gap-2">
                                          <Checkbox
                                              id={`${slot.id}-${day}`}
                                              checked={(slot.days || activeTimetable.days).includes(day)}
                                              onCheckedChange={() => handleDayToggle(index, day)}
                                          />
                                          <Label htmlFor={`${slot.id}-${day}`} className="text-sm font-normal">{day}</Label>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )
          })}
        </div>
        <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveTimeSlots}>Save Changes</Button>
        </DialogFooter>
      </>
    );
}

export default function SystemSettings({ open, onOpenChange }: SystemSettingsProps) {
    const { activeTimetable } = useTimetable();

    if (!activeTimetable) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="font-headline">System Settings</DialogTitle>
                    <DialogDescription>
                        Customize settings for your school. Changes may reset the current timetable.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-1">
                    <Label>School</Label>
                    <Select value={activeTimetable.id} disabled>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="School" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={activeTimetable.id}>{activeTimetable.name}</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
                 <Tabs defaultValue="time-slots" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="time-slots">Time Slots</TabsTrigger>
                        <TabsTrigger value="locked-periods">Locked Periods</TabsTrigger>
                    </TabsList>
                    <TabsContent value="time-slots" className="max-h-[60vh] overflow-y-auto p-1 pr-4">
                        <TimeSlotsTab onSaveChanges={() => onOpenChange(false)} />
                    </TabsContent>
                    <TabsContent value="locked-periods" className="max-h-[60vh] overflow-y-auto p-1 pr-4">
                       <LockedSessionsTab />
                        <DialogFooter className="pt-4">
                            <DialogClose asChild>
                                <Button type="button">Done</Button>
                            </DialogClose>
                        </DialogFooter>
                    </TabsContent>
                 </Tabs>
            </DialogContent>
        </Dialog>
    )
}

    