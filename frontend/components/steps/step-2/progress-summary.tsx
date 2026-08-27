import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { CARD_STATUSES, type DecompositionCard } from "./data";

type ProgressSummaryProps = {
  cards: DecompositionCard[];
};

export function ProgressSummary({ cards }: ProgressSummaryProps) {
  const counts = CARD_STATUSES.map((status) => ({
    status,
    count: cards.filter((card) => card.status === status).length,
  })).filter((entry) => entry.count > 0);

  return (
    <section className="summary step2-summary">
      <div className="summary-title">
        <span className="icon-box blue-soft">
          <FileText size={27} />
        </span>
        <strong>Tóm tắt vòng 2</strong>
      </div>
      <div className="status-chips">
        {counts.map(({ status, count }) => (
          <span
            className={`status-chip status-chip-${status.toLowerCase()}`}
            key={status}
          >
            {count} {status}
          </span>
        ))}
      </div>
      <Link href="/step-3" className="next-step-cta">
        Xác nhận &amp; sang Bước 3
        <ArrowRight size={20} />
      </Link>
    </section>
  );
}
