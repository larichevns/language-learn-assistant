import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  NotebookPen,
  SpellCheck2,
} from 'lucide-react';

export interface NavItem {
  href: string;
  /** key under the `nav` i18n namespace */
  key: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/vocabulary', key: 'vocabulary', icon: BookOpen },
  { href: '/grammar', key: 'grammar', icon: SpellCheck2 },
  { href: '/homework', key: 'homework', icon: NotebookPen },
  { href: '/exercises', key: 'exercises', icon: ListChecks },
  { href: '/notes', key: 'notes', icon: GraduationCap },
];
