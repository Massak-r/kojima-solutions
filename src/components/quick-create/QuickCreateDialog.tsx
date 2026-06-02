import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserSearch, Check, FolderKanban, Building2 } from "lucide-react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";

export type QuickCreateKind = "project" | "client";

/** Optional seed values when opening the dialog (e.g. pre-select a client). */
export interface QuickCreatePreset {
  clientId?: string;
}

interface Props {
  kind: QuickCreateKind | null;
  onClose: () => void;
  preset?: QuickCreatePreset;
}

export function QuickCreateDialog({ kind, onClose, preset }: Props) {
  return (
    <ResponsiveDialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        {kind === "project" && <ProjectForm onClose={onClose} initialClientId={preset?.clientId ?? null} />}
        {kind === "client" && <ClientForm onClose={onClose} />}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ProjectForm({ onClose, initialClientId = null }: { onClose: () => void; initialClientId?: string | null }) {
  const { createProject, updateProject } = useProjects();
  const { clients } = useClients();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string | null>(initialClientId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedClient = clientId ? clients.find((c) => c.id === clientId) ?? null : null;
  const canSubmit = title.trim().length > 0;

  function submit() {
    if (!canSubmit) return;
    const p = createProject(title.trim());
    if (clientId && selectedClient) {
      updateProject(p.id, { clientId, client: selectedClient.name });
    }
    toast.success("Projet créé");
    onClose();
    setTitle("");
    setClientId(null);
    navigate(`/project/${p.id}/brief`);
  }

  return (
    <>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-primary" />
          Nouveau projet
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          Donnez-lui un nom et associez-le optionnellement à un client existant.
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="qc-project-title">Titre du projet *</Label>
          <Input
            id="qc-project-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Refonte du site Acme"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Client (optionnel)</Label>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-between font-normal h-9"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <UserSearch className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {selectedClient?.name ?? "Aucun client"}
                  </span>
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
              <Command>
                <CommandInput placeholder="Rechercher…" />
                <CommandList>
                  <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                  <CommandGroup>
                    {clientId && (
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          setClientId(null);
                          setPickerOpen(false);
                        }}
                      >
                        <Check className="w-3.5 h-3.5 mr-2 opacity-0" />
                        <span className="text-xs text-muted-foreground">
                          Sans client
                        </span>
                      </CommandItem>
                    )}
                    {clients.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`${c.name} ${c.organization ?? ""} ${c.email ?? ""}`}
                        onSelect={() => {
                          setClientId(c.id);
                          setPickerOpen(false);
                        }}
                      >
                        <Check
                          className={`w-3.5 h-3.5 mr-2 ${
                            c.id === clientId ? "opacity-100 text-primary" : "opacity-0"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">
                            {c.name}
                          </div>
                          {(c.organization || c.email) && (
                            <div className="text-[10px] text-muted-foreground truncate">
                              {[c.organization, c.email].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <ResponsiveDialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          Créer le projet
        </Button>
      </ResponsiveDialogFooter>
    </>
  );
}

function ClientForm({ onClose }: { onClose: () => void }) {
  const { addClient } = useClients();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");

  const canSubmit = name.trim().length > 0;

  function submit() {
    if (!canSubmit) return;
    addClient({
      name: name.trim(),
      email: email.trim() || undefined,
      organization: organization.trim() || undefined,
    });
    toast.success("Client ajouté");
    onClose();
    setName("");
    setEmail("");
    setOrganization("");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && canSubmit) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          Nouveau client
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          Détails additionnels (téléphone, adresse, notes) ajoutables ensuite depuis la fiche.
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="qc-client-name">Nom *</Label>
          <Input
            id="qc-client-name"
            autoFocus
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du contact"
            onKeyDown={handleKey}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qc-client-email">Email</Label>
          <Input
            id="qc-client-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@exemple.ch"
            onKeyDown={handleKey}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qc-client-org">Société</Label>
          <Input
            id="qc-client-org"
            autoComplete="organization"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="Optionnel"
            onKeyDown={handleKey}
          />
        </div>
      </div>
      <ResponsiveDialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          Ajouter le client
        </Button>
      </ResponsiveDialogFooter>
    </>
  );
}
