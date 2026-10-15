import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Bot,
  Users,
  FileText,
  ShieldCheck,
  Scale,
  DollarSign,
  OctagonAlert,
  Activity,
  Settings,
  ClipboardList,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import ApprovalQueuePage from "../ApprovalQueue/ApprovalQueuePage";
import ProposalsPage from "../Proposals/ProposalsPage";
import AuditLogPage from "../AuditLog/AuditLogPage";
import SettingsPage from "../Settings/SettingsPage";
import DependencyViewerPage from "../DependencyViewer/DependencyViewerPage";
import {
  AgentsPage,
  BoardroomPage,
  CostsPage,
  DriftPage,
  KillSwitchPage,
  OverviewPage,
  PolicyPage,
} from "../Governance/GovernancePages";

export const NAV_IDS = [
  "Dashboard",
  "Agents",
  "ApprovalQueue",
  "Proposals",
  "DependencyViewer",
  "AuditLog",
  "PolicyManager",
  "DigitalBoardroom",
  "CostDashboard",
  "KillSwitch",
  "DriftMonitor",
  "Settings",
] as const;

export type NavId = (typeof NAV_IDS)[number];

export interface NavItem {
  id: NavId;
  label: string;
  icon: LucideIcon;
  Component: ComponentType;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "Dashboard",        label: "Overview",           icon: LayoutDashboard,   Component: OverviewPage },
  { id: "Agents",           label: "Agents",             icon: Bot,               Component: AgentsPage },
  { id: "ApprovalQueue",    label: "Approval Queue",     icon: Users,             Component: ApprovalQueuePage },
  { id: "Proposals",        label: "Proposals",          icon: ClipboardList,     Component: ProposalsPage },
  { id: "DependencyViewer", label: "Dependency Viewer", icon: Search,             Component: DependencyViewerPage },
  { id: "AuditLog",         label: "Audit Trail",         icon: FileText,          Component: AuditLogPage },
  { id: "PolicyManager",    label: "Policy Manager",     icon: ShieldCheck,       Component: PolicyPage },
  { id: "DigitalBoardroom", label: "Digital Boardroom",  icon: Scale,             Component: BoardroomPage },
  { id: "CostDashboard",    label: "Cost Dashboard",     icon: DollarSign,        Component: CostsPage },
  { id: "KillSwitch",       label: "Kill Switches",      icon: OctagonAlert,      Component: KillSwitchPage },
  { id: "DriftMonitor",     label: "Drift Monitor",      icon: Activity,          Component: DriftPage },
  { id: "Settings",         label: "Settings",           icon: Settings,          Component: SettingsPage },
];

export const DEFAULT_NAV_ID: NavId = "Dashboard";