
"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

interface ErrorDisplayProps {
  message: string;
}

export default function ErrorDisplay({ message }: ErrorDisplayProps) {
  return (
    <Alert variant="destructive" className="max-w-xl text-left">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Timetable Generation Failed</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
