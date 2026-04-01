import {
  FileText, Image, MapPin, Mail, CalendarDays, Newspaper, ShoppingBag,
  CreditCard, Lock, Globe, Search, BarChart3, MessageCircle, Users,
  Settings, Server, LayoutGrid, MousePointerClick,
} from "lucide-react";

export const ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  FileText, Image, MapPin, Mail, CalendarDays, Newspaper, ShoppingBag,
  CreditCard, Lock, Globe, Search, BarChart3, MessageCircle, Users,
  Settings, Server, LayoutGrid, MousePointerClick,
};

export function ModuleIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name];
  return Icon ? <Icon size={size} className={className} /> : null;
}
