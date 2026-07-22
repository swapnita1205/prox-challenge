/**
 * Canonical machine topology derived from owner-manual.pdf p8 (Front Panel Controls)
 * and p13–14 (polarity setup). IDs are stable across graph builds.
 */

export const CANONICAL_PORTS = [
  { id: "port-positive", name: "Positive (+) Socket", polarity: "positive" as const, label: "+" },
  { id: "port-negative", name: "Negative (−) Socket", polarity: "negative" as const, label: "−" },
  { id: "port-ground-workpiece", name: "Workpiece Ground", polarity: "ground" as const },
  { id: "port-mig-gun", name: "MIG Gun / Spool Gun Cable Socket", polarity: "neutral" as const },
] as const;

export const CANONICAL_CABLES = [
  { id: "cable-ground-clamp", name: "Ground Clamp Cable" },
  { id: "cable-wire-feed-power", name: "Wire Feed Power Cable" },
  { id: "cable-tig-torch", name: "TIG Torch Cable" },
  { id: "cable-electrode-holder", name: "Electrode Holder Cable" },
] as const;

export const CANONICAL_COMPONENTS = [
  { id: "comp-positive-socket", name: "Positive Socket", location: "front_panel" as const },
  { id: "comp-negative-socket", name: "Negative Socket", location: "front_panel" as const },
  { id: "comp-mig-gun-socket", name: "MIG Gun Cable Socket", location: "front_panel" as const },
  { id: "comp-wire-feed-mechanism", name: "Wire Feed Mechanism", location: "interior" as const },
  { id: "comp-wire-feed-tensioner", name: "Wire Feed Tensioner", location: "interior" as const },
  { id: "comp-lcd-display", name: "LCD Display", location: "front_panel" as const },
  { id: "comp-power-switch", name: "Power Switch", location: "front_panel" as const },
  { id: "comp-main-control-knob", name: "Main Control Knob", location: "front_panel" as const },
  { id: "comp-gas-inlet", name: "Gas Inlet", location: "rear" as const },
  { id: "comp-contact-tip", name: "Contact Tip", location: "torch" as const },
  { id: "comp-nozzle", name: "Gas Nozzle", location: "torch" as const },
  { id: "comp-ground-clamp", name: "Ground Clamp", location: "workpiece" as const },
] as const;

export const CANONICAL_PROCESSES = [
  {
    id: "process-mig-solid",
    name: "MIG Solid Core (Gas Shielded)",
    slug: "mig-solid" as const,
    description: "DCEP — owner-manual.pdf p14",
  },
  {
    id: "process-flux",
    name: "Flux-Cored (Gasless)",
    slug: "flux" as const,
    description: "DCEN — owner-manual.pdf p13",
  },
  {
    id: "process-tig",
    name: "TIG Welding",
    slug: "tig" as const,
  },
  {
    id: "process-stick",
    name: "Stick Welding",
    slug: "stick" as const,
  },
  {
    id: "process-mig",
    name: "MIG/Flux (General)",
    slug: "mig" as const,
  },
] as const;

export const CANONICAL_MATERIALS = [
  { id: "material-mild-steel", name: "Mild Steel" },
  { id: "material-stainless-steel", name: "Stainless Steel" },
  { id: "material-aluminum", name: "Aluminum" },
  { id: "material-chrome-moly", name: "Chrome Moly" },
] as const;

export const CANONICAL_CONSUMABLES = [
  { id: "consumable-solid-wire", name: "Solid Core Wire", kind: "solid_wire" as const },
  { id: "consumable-flux-wire", name: "Flux-Cored Wire", kind: "flux_core_wire" as const },
  { id: "consumable-c25-gas", name: "C25 Shielding Gas", kind: "gas" as const },
  { id: "consumable-100-argon", name: "100% Argon", kind: "gas" as const },
  { id: "consumable-tig-rod", name: "TIG Filler Rod", kind: "wire" as const },
  { id: "consumable-stick-electrode", name: "Stick Electrode", kind: "electrode" as const },
] as const;

export const COMPONENT_PORT_WIRING = [
  { componentId: "comp-positive-socket", portId: "port-positive" },
  { componentId: "comp-negative-socket", portId: "port-negative" },
  { componentId: "comp-mig-gun-socket", portId: "port-mig-gun" },
] as const;

export const PROCESS_CONSUMABLES: Record<string, string[]> = {
  "process-mig-solid": ["consumable-solid-wire", "consumable-c25-gas"],
  "process-flux": ["consumable-flux-wire"],
  "process-tig": ["consumable-100-argon", "consumable-tig-rod"],
  "process-stick": ["consumable-stick-electrode"],
};

export const INGEST_PROCESS_MAP: Record<string, string> = {
  mig: "process-mig",
  "mig-solid": "process-mig-solid",
  flux: "process-flux",
  tig: "process-tig",
  stick: "process-stick",
};
