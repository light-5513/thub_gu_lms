import { Link } from "react-router-dom";
import { ArrowUpRight, BarChart3 } from "lucide-react";
import { CodingInsightsPanel } from "@/components/coding/CodingInsightsPanel";

export function CodingStatsPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-primary-700 shadow-card-recess">
            <BarChart3 size={14} /> Coding activity
          </div>
          <h1 className="page-title">Your coding stats</h1>
          <p className="page-description">Separate platform snapshots and date-filtered progress from your connected profiles.</p>
        </div>
        <Link to="/student/profile" className="btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold">
          Manage profiles <ArrowUpRight size={14} />
        </Link>
      </div>
      <CodingInsightsPanel heading="Your platform breakdown" />
    </div>
  );
}
