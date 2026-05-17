import { ZodError } from 'zod';

export type ValidationFieldError = {
  field: string;
  code: string;
  message: string;
};

export type ValidationErrorDetails = {
  fields: ValidationFieldError[];
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
};

export const formatZodError = (error: ZodError): {
  message: string;
  details: ValidationErrorDetails;
} => {
  const flattened = error.flatten();

  const fields: ValidationFieldError[] = error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'root',
    code: issue.code,
    message: issue.message,
  }));

  const firstMessage = fields[0]?.message ?? flattened.formErrors[0] ?? 'Validation failed';

  return {
    message: firstMessage,
    details: {
      fields,
      fieldErrors: flattened.fieldErrors as Record<string, string[]>,
      formErrors: flattened.formErrors,
    },
  };
};
