/**
 * Command Media (documents library) — labels for Prisma {@link DocumentType} values from the API.
 */
export const COMMAND_MEDIA_DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: 'Procedure', label: 'Procedure' },
  { value: 'Policy', label: 'Policy' },
  { value: 'QualityManual', label: 'Quality Manual' },
  { value: 'Standard', label: 'Standard' },
  { value: 'StandardOperatingProcedure', label: 'SOP' },
  { value: 'WorkInstruction', label: 'Work Instruction' },
  { value: 'Form', label: 'Form/Template' },
];

export function commandMediaDocumentTypeLabel(documentType: string): string {
  return COMMAND_MEDIA_DOCUMENT_TYPES.find((d) => d.value === documentType)?.label ?? documentType;
}
