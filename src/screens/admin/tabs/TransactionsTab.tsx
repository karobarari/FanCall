import { EmptyState } from "../components/EmptyState";

// TODO(payments): build this tab against your payments/transactions endpoint.
export function TransactionsTab() {
  return (
    <EmptyState
      title="Transactions"
      lines={[
        "Payments aren't integrated yet.",
        "TODO(payments): wire GET /api/transactions (or your provider) and render the table here.",
      ]}
    />
  );
}
