import { Check } from "lucide-react";
import {
  getOrderProgress,
  getBookingProgress,
  type ProgressResult,
} from "@shared/accountFormatters";

interface ProgressTrackerProps {
  type: "order" | "booking";
  status: string;
}

export function ProgressTracker({ type, status }: ProgressTrackerProps) {
  const result: ProgressResult =
    type === "order" ? getOrderProgress(status) : getBookingProgress(status);

  if (result.terminal === "unknown") {
    return null;
  }

  if (result.terminal === "cancelled" || result.terminal === "refused") {
    const text =
      result.terminal === "cancelled"
        ? "Pedido cancelado"
        : "Agendamento recusado";
    return (
      <div className="progress-tracker-terminal" role="status">
        <span>{text}</span>
      </div>
    );
  }

  const { steps, currentIndex } = result;
  const typeLabel = type === "order" ? "pedido" : "agendamento";
  const currentStepLabel = steps[currentIndex] ?? "";
  const ariaLabel = `Andamento do ${typeLabel}: ${currentStepLabel}, etapa ${currentIndex + 1} de ${steps.length}`;

  return (
    <div className="progress-tracker">
      <ol className="progress-tracker-list" aria-label={ariaLabel}>
        {steps.map((step, idx) => {
          const isCompleted = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          const isLastStep = idx === steps.length - 1;
          const showCheck = isLastStep && currentIndex === steps.length - 1;

          let stepClass = "progress-tracker-step";
          if (isCompleted) stepClass += " is-completed";
          if (isCurrent) stepClass += " is-current";

          return (
            <li
              key={step}
              className={stepClass}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="progress-tracker-dot" aria-hidden="true">
                {showCheck && <Check size={9} strokeWidth={3} />}
              </span>
              <span className="progress-tracker-label">{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default ProgressTracker;

