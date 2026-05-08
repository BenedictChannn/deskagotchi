/**
 * Shared Hatch input contract and validation rules.
 *
 * @module
 */
import { z } from "zod";

import {
  ColorHexSchema,
  type ValidationIssue,
  ValidationSeverity
} from "./domain";

/** Maximum visible pet name length accepted by Hatch. */
export const HATCH_NAME_MAX_LENGTH = 40;

/** Maximum prompt description length that still fits the generated pet manifest. */
export const HATCH_DESCRIPTION_MAX_LENGTH = 200;

/** Maximum free-form species or concept length accepted by Hatch. */
export const HATCH_SPECIES_MAX_LENGTH = 80;

/** Maximum personality descriptor length accepted by Hatch. */
export const HATCH_PERSONALITY_MAX_LENGTH = 120;

/** Maximum optional accessory or theme descriptor length accepted by Hatch. */
export const HATCH_OPTIONAL_TEXT_MAX_LENGTH = 120;

const OptionalHatchTextSchema = z
  .string()
  .trim()
  .max(HATCH_OPTIONAL_TEXT_MAX_LENGTH)
  .optional();

/** Runtime-validated Hatch form payload accepted over IPC and browser dev mode. */
export const HatchDraftInputSchema = z
  .object({
    name: z.string().trim().max(HATCH_NAME_MAX_LENGTH),
    description: z.string().trim().max(HATCH_DESCRIPTION_MAX_LENGTH),
    species: z.string().trim().max(HATCH_SPECIES_MAX_LENGTH),
    personality: z.string().trim().max(HATCH_PERSONALITY_MAX_LENGTH),
    preferredColors: z.array(ColorHexSchema).min(2).max(8),
    accessory: OptionalHatchTextSchema,
    theme: OptionalHatchTextSchema
  })
  .strict();

/** Input collected by Hatch before generating or installing a draft pet package. */
export type HatchDraftInput = z.infer<typeof HatchDraftInputSchema>;

const BLOCKED_HATCH_TERMS = [
  "tamagotchi",
  "bandai",
  "codex",
  "pokemon",
  "pikachu",
  "disney",
  "mario",
  "sonic",
  "hateful",
  "sexual"
];

/**
 * Validate Hatch prompt input before creating local package files.
 *
 * Args:
 *   input: Hatch prompt details from the renderer.
 *
 * Returns:
 *   Package-style validation issues for blocked or invalid input.
 */
export function validateHatchDraftInput(input: HatchDraftInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const combinedText = `${input.name} ${input.description} ${input.species} ${input.personality} ${input.accessory ?? ""} ${input.theme ?? ""}`.toLowerCase();

  for (const blockedTerm of BLOCKED_HATCH_TERMS) {
    if (combinedText.includes(blockedTerm)) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "hatch_prompt_blocked_term",
        message: `Hatch prompts cannot request protected, unsafe, or confusingly similar content: '${blockedTerm}'.`
      });
    }
  }

  if (input.name.trim().length < 1) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "hatch_name_invalid",
      message: `Pet name must be between 1 and ${HATCH_NAME_MAX_LENGTH} characters.`
    });
  }

  if (input.description.trim().length < 1) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "hatch_description_invalid",
      message: `Pet description must be between 1 and ${HATCH_DESCRIPTION_MAX_LENGTH} characters.`
    });
  }

  if (input.species.trim().length < 1) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "hatch_species_invalid",
      message: `Pet species must be between 1 and ${HATCH_SPECIES_MAX_LENGTH} characters.`
    });
  }

  if (input.personality.trim().length < 1) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "hatch_personality_invalid",
      message: `Pet personality must be between 1 and ${HATCH_PERSONALITY_MAX_LENGTH} characters.`
    });
  }

  return issues;
}
