# **App Name**: Timetable Weaver

## Core Features:

- Teacher and Subject Input: Allows input of teachers' names, their respective subjects, and the number of periods desired for each subject.
- Automated Timetable Generation: AI powered timetable generator considering teacher availability and subject requirements, incorporating tool usage for efficient scheduling.
- Drag and Drop Editing: Enables drag-and-drop functionality for timetable adjustments. The new adjusted time slots can automatically update the other conflicting slots and/or propose possible slot changes.
- Real-time conflict flagging: Highlights scheduling conflicts (e.g., double-booking a teacher).
- Print/Export Timetable: Exports generated timetable.
- Persistent Data Storage: Store the Timetable configurations into a Firestore database, for multiple timetable configurations, such as a timetable for 'this year', or 'next semester'.

## Style Guidelines:

- Primary color: Muted blue (#6699CC) to inspire calmness and focus.
- Background color: Very light blue (#EBF2FA), almost white, providing a clean and non-distracting backdrop.
- Accent color: Yellow-orange (#E2954B), warmer than the primary, for key actions.
- Headline font: 'Space Grotesk' sans-serif, used for headlines and short amounts of body text.
- Body font: 'Inter' sans-serif, for longer lines of body text.
- Use minimalist icons to represent subjects and teachers.
- Subtle transition animations on drag and drop interactions.