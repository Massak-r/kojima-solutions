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
  Wallet,
  ArrowLeft,
  LogOut,
  Plus,
  Building2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuickCreate } from "@/contexts/QuickCreateContext";

const NAV_ITEMS = [
  { label: "Accueil",    to: "/home",              icon: LayoutDashboard, shortcut: "1" },
  { label: "Projets",    to: "/home?tab=kanban",   icon: FolderKanban,    shortcut: "2" },
  { label: "Devis",      to: "/quotes",            icon: FileText,        shortcut: "3" },
  { label: "Clients",    to: "/clients",           icon: Users,           shortcut: "4" },
  { label: "Finance",    to: "/accounting",        icon: TrendingUp,      shortcut: "5" },
  { label: "Trésorerie", to: "/tresorerie",        icon: Wallet,          shortcut: "6" },
  { label: "Documents",  to: "/documents",         icon: FileText,        shortcut: "7" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, logoutAdmin } = useAuth();
  const { open: openQuickCreate } = useQuickCreate();

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
          <CommandItem
            onSelect={() => {
              openQuickCreate("project");
              setOpen(false);
            }}
          >
            <FolderKanban className="mr-2 h-4 w-4" />
            <span>Nouveau projet</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              openQuickCreate("client");
              setOpen(false);
            }}
          >
            <Building2 className="mr-2 h-4 w-4" />
            <span>Nouveau client</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/quotes/new")}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Nouveau devis</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span>Retour au site</span>
          </CommandItem>
          <CommandItem onSelect={() => { logoutAdmin(); navigate("/"); setOpen(false); }}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Déconnexion</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
