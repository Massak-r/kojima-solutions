import {
  FileText, Image, MapPin, Mail, CalendarCheck, Send, BarChart3,
  MessageCircle, UserCircle, ShoppingBag, CreditCard, Lock, Globe,
  Search, Settings, Server,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  FileText, Image, MapPin, Mail, CalendarCheck, Send, BarChart3,
  MessageCircle, UserCircle, ShoppingBag, CreditCard, Lock, Globe,
  Search, Settings, Server,
};

export function ModuleIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[name];
  return Icon ? <Icon size={size} className={className} /> : null;
}
