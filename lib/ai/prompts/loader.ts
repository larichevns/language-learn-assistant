/**
 * Prompt template resolution. `{{var}}` placeholders are replaced from a vars
 * map; `{{language}}` expands an ISO code to a name. In Phase 2 templates come
 * from the admin-editable `PromptTemplate` table; the resolution is identical.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  de: 'German',
  ru: 'Russian',
  en: 'English',
};

export type TemplateVars = Record<string, string | number | undefined>;

export function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    if (key === 'language' || key === 'native_language') {
      const code = String(vars[key] ?? (key === 'language' ? 'de' : 'ru'));
      return LANGUAGE_NAMES[code] ?? code;
    }
    const value = vars[key];
    return value == null ? '' : String(value);
  });
}

export interface ResolvedTemplate {
  systemPrompt: string;
  userPrompt: string;
}

export function resolveTemplate(
  template: { systemPrompt: string; userPromptTemplate: string },
  vars: TemplateVars,
): ResolvedTemplate {
  return {
    systemPrompt: interpolate(template.systemPrompt, vars),
    userPrompt: interpolate(template.userPromptTemplate, vars),
  };
}
