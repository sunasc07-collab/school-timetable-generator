
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
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import type { TimeSlot } from "@/lib/types";
import { Checkbox } from "./ui/checkbox";

interface SystemSettingsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function SystemSettings({ open, onOpenChange }: SystemSettingsProps) {
    const { activeTimetable, updateTimeSlots } = useTimetable();
    const [localTimeSlots, setLocalTimeSlots] = useState<TimeSlot[]>([]);

    useEffect(() => {
        if (activeTimetable) {
            setLocalTimeSlots(JSON.parse(JSON.stringify(activeTimetable.timeSlots)));
        }
    }, [activeTimetable, open]);

    const handleTimeSlotChange = (index: number, field: keyof TimeSlot, value: any) => {
        const newTimeSlots = [...localTimeSlots];
        // @ts-ignore
        newTimeSlots[index][field] = value;
        setLocalTimeSlots(newTimeSlots);
    };

    const handleDayToggle = (index: number, day: string) => {
        const newTimeSlots = [...localTimeSlots];
        const slot = newTimeSlots[index];
        const currentDays = slot.days || activeTimetable?.days || [];
        const newDays = currentDays.includes(day)
            ? currentDays.filter(d => d !== day)
            : [...currentDays, day];
        
        handleTimeSlotChange(index, 'days', newDays);
    }

    const handleAddSlot = (index: number) => {
        const newSlot: TimeSlot = {
            id: crypto.randomUUID(),
            period: null,
            time: '00:00-00:00',
            isBreak: false,
            label: '',
            days: activeTimetable?.days || []
        };
        const newTimeSlots = [...localTimeSlots];
        newTimeSlots.splice(index + 1, 0, newSlot);
        setLocalTimeSlots(newTimeSlots);
    };

    const handleRemoveSlot = (index: number) => {
        const newTimeSlots = localTimeSlots.filter((_, i) => i !== index);
        setLocalTimeSlots(newTimeSlots);
    };

    const handleSaveChanges = () => {
        updateTimeSlots(localTimeSlots);
        onOpenChange(false);
    }
    
    if (!activeTimetable) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="font-headline">System Settings</DialogTitle>
                    <DialogDescription>
                        Customize the time slots for '{activeTimetable.name}'. Changes will reset the current timetable.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto p-1 pr-4">
                    <div className="grid gap-4 py-4">
                        {localTimeSlots.map((slot, index) => (
                            <div key={slot.id} className="grid grid-cols-1 items-end gap-3 p-3 border rounded-lg relative group">
                                <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-end gap-3">
                                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                                    
                                    <div className="space-y-1">
                                        <Label htmlFor={`time-${index}`}>Time Range</Label>
                                        <Input
                                            id={`time-${index}`}
                                            value={slot.time}
                                            onChange={(e) => handleTimeSlotChange(index, 'time', e.target.value)}
                                            placeholder="e.g., 8:00-8:40"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor={`label-${index}`}>Label</Label>
                                        <Input
                                            id={`label-${index}`}
                                            value={slot.label || ''}
                                            onChange={(e) => handleTimeSlotChange(index, 'label', e.target.value)}
                                            placeholder="e.g., Short Break"
                                            disabled={!slot.isBreak}
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
                                                    handleTimeSlotChange(index, 'label', 'Break')
                                                } else {
                                                    handleTimeSlotChange(index, 'label', '')
                                                }
                                            }}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <Button variant="outline" size="sm" className="h-8" onClick={() => handleAddSlot(index)}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Slot
                                        </Button>
                                        <Button variant="destructive" size="sm" className="h-8" onClick={() => handleRemoveSlot(index)} disabled={localTimeSlots.length <= 1}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                                {slot.isBreak && (
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
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSaveChanges}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
