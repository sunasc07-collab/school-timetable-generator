'use server';

/**
 * @fileOverview A flow to suggest conflict resolutions for timetable scheduling.
 *
 * - suggestConflictResolution - A function that suggests alternative timeslots or teacher assignments to resolve scheduling conflicts.
 * - SuggestConflictResolutionInput - The input type for the suggestConflictResolution function.
 * - SuggestConflictResolutionOutput - The return type for the suggestConflictResolution function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestConflictResolutionInputSchema = z.object({
  timetable: z.string().describe('The current timetable configuration as a JSON string.'),
  conflictingEvent: z.string().describe('Details of the event causing the conflict as a JSON string.'),
  constraints: z.string().describe('Scheduling constraints (e.g., teacher availability) as a JSON string.'),
});
export type SuggestConflictResolutionInput = z.infer<typeof SuggestConflictResolutionInputSchema>;

const SuggestConflictResolutionOutputSchema = z.object({
  suggestions: z.array(
    z.object({
      timeslot: z.string().optional().describe('Suggested alternative timeslot.'),
      teacher: z.string().optional().describe('Suggested alternative teacher.'),
      reason: z.string().describe('Reasoning for the suggestion.'),
    })
  ).describe('A list of suggested conflict resolutions.'),
});
export type SuggestConflictResolutionOutput = z.infer<typeof SuggestConflictResolutionOutputSchema>;

export async function suggestConflictResolution(input: SuggestConflictResolutionInput): Promise<SuggestConflictResolutionOutput> {
  return suggestConflictResolutionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestConflictResolutionPrompt',
  input: {schema: SuggestConflictResolutionInputSchema},
  output: {schema: SuggestConflictResolutionOutputSchema},
  prompt: `You are a timetable scheduling assistant. Given the current timetable, a description of a scheduling conflict, and scheduling constraints, suggest alternative timeslots or teacher assignments to resolve the conflict.

Timetable:
{{timetable}}

Conflicting Event:
{{conflictingEvent}}

Constraints:
{{constraints}}

Suggest at least 3 possible solutions.

Format your response as a JSON array of suggestions with the following structure:

[{
  "timeslot": "Suggested alternative timeslot (if applicable)",
  "teacher": "Suggested alternative teacher (if applicable)",
  "reason": "Reasoning for this suggestion"
}]
`,
});

const suggestConflictResolutionFlow = ai.defineFlow(
  {
    name: 'suggestConflictResolutionFlow',
    inputSchema: SuggestConflictResolutionInputSchema,
    outputSchema: SuggestConflictResolutionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
