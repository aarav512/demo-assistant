export const EMPTY_CALLS = {
  title: "No demo calls yet",
  description:
    "Completed browser demos will appear here. Sample records are labelled and are not counted as real activity.",
};

export const EMPTY_APPOINTMENTS = {
  title: "No appointment requests yet",
  description: "When the receptionist saves a request, it will show up here as new. Nothing is confirmed until you confirm it.",
};

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
