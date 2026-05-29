import { useEffect, useState } from "react";
import { api } from "../lib/utils";

interface Email {
  id: string;
  messageId: string;
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  status: string;
  failureReason: string | null;
  createdAt: string;
}

export default function EmailLogs() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.emails.list(page).then((res) => {
      setEmails(res.data);
      setTotal(res.total);
    });
  }, [page]);

  const statusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "text-green-600 bg-green-50";
      case "failed":
        return "text-red-600 bg-red-50";
      case "processing":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Email Logs</h1>

      <div className="space-y-3">
        {emails.map((email) => (
          <div key={email.id} className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium truncate flex-1">
                {email.subject || "(no subject)"}
              </p>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(
                  email.status
                )}`}
              >
                {email.status}
              </span>
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              <p>
                From: {email.fromEmail} → To: {email.toEmail}
              </p>
              <p>ID: {email.messageId}</p>
              <p>{new Date(email.createdAt).toLocaleString()}</p>
              {email.failureReason && (
                <p className="text-red-600">Error: {email.failureReason}</p>
              )}
            </div>
          </div>
        ))}
        {emails.length === 0 && (
          <p className="text-gray-500 text-center py-8">No emails sent yet</p>
        )}
      </div>

      {total > 50 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1">
            Page {page} of {Math.ceil(total / 50)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 50)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
