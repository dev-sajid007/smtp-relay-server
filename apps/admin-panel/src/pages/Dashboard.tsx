import { useEffect, useState } from "react";
import { api } from "../lib/utils";

export default function Dashboard() {
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      api.emails.list(1),
      api.queue.status(),
      api.domains.list(),
      api.smtp.list(),
    ]).then(([emails, queue, domains, smtp]) => {
      setStats({
        "Total Emails": emails.total,
        "Queue Waiting": queue.waiting,
        "Domains": domains.length,
        "SMTP Credentials": smtp.length,
      });
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="bg-white p-6 rounded-lg shadow-sm border">
            <p className="text-sm text-gray-500">{key}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
