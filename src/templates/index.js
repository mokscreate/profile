import { ClassicTemplate } from './template-classic.js';
import { ModernTemplate } from './template-modern.js';
import { MinimalTemplate } from './template-minimal.js';

export const templates = {
  classic: new ClassicTemplate(),
  modern: new ModernTemplate(),
  minimal: new MinimalTemplate()
};
