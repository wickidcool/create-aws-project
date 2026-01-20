import { JSONSchemaType } from 'ajv';
import type { CreateUserRequest, UpdateUserRequest } from '{{PACKAGE_SCOPE}}/common-types';

/**
 * JSON Schema for CreateUserRequest
 */
export const createUserSchema: JSONSchemaType<CreateUserRequest> = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      format: 'email',
      minLength: 3,
      maxLength: 255,
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      pattern: '^(?!\\s*$)(?!.*\\s$)(?!^\\s).*$', // No leading/trailing whitespace, not empty
    },
  },
  required: ['email', 'name'],
  additionalProperties: false,
};

/**
 * JSON Schema for UpdateUserRequest
 */
export const updateUserSchema: JSONSchemaType<UpdateUserRequest> = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      pattern: '^(?!\\s*$)(?!.*\\s$)(?!^\\s).*$', // No leading/trailing whitespace, not empty
      nullable: true,
    },
  },
  required: [],
  additionalProperties: false,
  minProperties: 1, // At least one property must be present
};
