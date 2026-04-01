import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Users,
  TrendingUp,
  UserCircle,
  Shield,
  ArrowLeft,
  LogOut,
  Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const NAV_ITEMS = [
  { label: "Space",      to: "/space",      icon: LayoutDashboard, shortcut: "1" },
  { label: "Projects",   to: "/projects",   icon: FolderKanban,    shortcut: "2" },
  { label: "Quotes",     to: "/quotes",     icon: FileText,        shortcut: "3" },
  { label: "Clients",    to: "/clients",    icon: Users,           shortcut: "4" },
  { label: "Finance",    to: "/accounting", icon: TrendingUp,      shortcut: "5" },
  { label: "Personnel",  to: "/personal",   icon: UserCircle,      shortcut: "6" },
  { label: "Admin",      to: "/admin",      icon: Shield,          shortcut: "7" },
];

const ACTIONS = [
  { label: "Nouveau devis",  to: "/quotes/new", icon: Plus },
  { label: "Retour au site", to: "/",            icon: ArrowLeft },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, logoutAdmin } = useAuth();

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function go(to: string) {
    navigate(to);
    setOpen(false);
  }

  if (!isAdmin) return null;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Naviguer, chercher..." />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map(({ label, to, icon: Icon, shortcut }) => (
            <CommandItem key={to} onSelect={() => go(to)}>
              <Icon className="mr-2 h-4 w-4" />
              <span>{label}</span>
              <CommandShortcut>⌘{shortcut}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Actions">
          {ACTIONS.map(({ label, to, icon: Icon }) => (
            <CommandItem key={to} onSelect={() => go(to)}>
              <Icon className="mr-2 h-4 w-4" />
              <span>{label}</span>
            </CommandItem>
          ))}
          <CommandItem onSelect={() => { logoutAdmin(); navigate("/"); setOpen(false); }}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Déconnexion</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
