import type { IssueStatus } from "@/lib/issueService";

const STATUS_CONFIG: Record<IssueStatus, { label: string; className: string }> = {
  pending: {
    label: "ລໍຖ້າ",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  in_progress: {
    label: "ກໍາລັງດໍາເນີນ",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  done: {
    label: "ສໍາເລັດ",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
};

export default function StatusBadge({ status }: { status: IssueStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
