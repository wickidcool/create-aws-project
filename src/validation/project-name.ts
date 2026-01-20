import validateNpmPackageName from 'validate-npm-package-name';

export function validateProjectName(name: string): true | string {
  if (!name.trim()) {
    return 'Project name is required';
  }

  const validation = validateNpmPackageName(name);
  if (!validation.validForNewPackages) {
    const errors = [...(validation.errors || []), ...(validation.warnings || [])];
    return errors[0] || 'Invalid package name';
  }

  return true;
}
