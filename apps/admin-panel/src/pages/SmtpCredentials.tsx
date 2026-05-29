import { useEffect, useState } from "react";
import { api } from "../lib/utils";

interface Credential {
  id: string;
  username: string;
  active: boolean;
  domain: { name: string };
  createdAt: string;
}

export default function SmtpCredentials() {
  const [creds, setCreds] = useState<Credential[]>([]);
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [newCred, setNewCred] = useState<{ username: string; rawPassword: string } | null>(null);

  const load = () =>
    Promise.all([
      api.smtp.list().then(setCreds),
      api.domains.list().then(setDomains),
    ]);

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!selectedDomain) return;
    const result = await api.smtp.create(selectedDomain);
    setNewCred(result);
    load();
  };

  const handleToggle = async (id: string) => {
    await api.smtp.toggle(id);
    load();
  };

  const handleRotate = async (id: string) => {
    const result = await api.smtp.rotate(id);
    alert(`New password: ${result.rawPassword}`);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete credential?")) return;
    await api.smtp.delete(id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">SMTP Credentials</h1>

      <div className="bg-white p-4 rounded-lg border mb-6">
        <h2 className="font-medium mb-3">Create New Credential</h2>
        <div className="flex gap-2">
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Select domain...</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={!selectedDomain}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Generate
          </button>
        </div>
        {newCred && (
          <div className="mt-3 p-3 bg-green-50 rounded text-sm">
            <p>
              <strong>Username:</strong> {newCred.username}
            </p>
            <p>
              <strong>Password:</strong> {newCred.rawPassword}
            </p>
            <p className="text-red-600 text-xs mt-1">
              Save these credentials now. Password won't be shown again.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {creds.map((cred) => (
          <div
            key={cred.id}
            className="bg-white p-4 rounded-lg border flex items-center justify-between"
          >
            <div>
              <p className="font-medium">{cred.username}</p>
              <p className="text-sm text-gray-500">
                Domain: {cred.domain.name} | Status:{" "}
                {cred.active ? "Active" : "Disabled"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleToggle(cred.id)}
                className={`px-3 py-1 text-sm rounded ${
                  cred.active
                    ? "bg-yellow-600 text-white hover:bg-yellow-700"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {cred.active ? "Disable" : "Enable"}
              </button>
              <button
                onClick={() => handleRotate(cred.id)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Rotate
              </button>
              <button
                onClick={() => handleDelete(cred.id)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {creds.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No credentials created yet
          </p>
        )}
      </div>
    </div>
  );
}
