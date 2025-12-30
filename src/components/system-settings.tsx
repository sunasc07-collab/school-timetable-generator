
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

    const handleAddSlot = (index: number) => {
        const newSlot: TimeSlot = {
            id: crypto.randomUUID(),
            period: null,
            time: '00:00-00:00',
            isBreak: false,
            isLocked: false,
            label: ''
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
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="font-headline">System Settings</DialogTitle>
                    <DialogDescription>
                        Customize the time slots for '{activeTimetable.name}'. Changes will reset the current timetable.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto p-1 pr-4">
                    <div className="grid gap-4 py-4">
                        {localTimeSlots.map((slot, index) => (
                            <div key={slot.id} className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] items-center gap-3 p-3 border rounded-lg relative group">
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
                                        disabled={!slot.isBreak && !slot.isLocked}
                                    />
                                </div>
                                <div className="flex flex-col items-center space-y-2">
                                    <Label htmlFor={`isBreak-${index}`} className="text-xs">Break</Label>
                                    <Switch
                                        id={`isBreak-${index}`}
                                        checked={slot.isBreak}
                                        onCheckedChange={(checked) => {
                                            handleTimeSlotChange(index, 'isBreak', checked)
                                            if (checked) handleTimeSlotChange(index, 'isLocked', false)
                                        }}
                                    />
                                </div>
                                <div className="flex flex-col items-center space-y-2">
                                    <Label htmlFor={`isLocked-${index}`} className="text-xs">Locked</Label>
                                    <Switch
                                        id={`isLocked-${index}`}
                                        checked={slot.isLocked}
                                        onCheckedChange={(checked) => {
                                            handleTimeSlotChange(index, 'isLocked', checked)
                                            if (checked) handleTimeSlotChange(index, 'isBreak', false)
                                        }}
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleAddSlot(index)}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveSlot(index)} disabled={localTimeSlots.length <= 1}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
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

    