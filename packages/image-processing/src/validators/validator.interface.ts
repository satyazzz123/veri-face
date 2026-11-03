import { ImageValidationContext, ValidationResult } from '@image-val/shared';

export interface ImageValidator {
  readonly ruleName: string;
  validate(context: ImageValidationContext): Promise<ValidationResult>;
}
