import { useEffect, useState } from "react";
import { api } from "../lib/utils";

interface Domain {
  id: string;
  name: string;
  verified: boolean;
  dkimSelector: string | null;
  createdAt: string;
}

export default function Domains() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState("");

  const load = () => api.domains.list().then(setDomains);

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.domains.create(newDomain);
    setNewDomain("");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete domain?")) return;
    await api.domains.delete(id);
    load();
  };

  const handleGenerateDkim = async (id: string) => {
    const result = await api.domains.generateDkim(id);
    alert(`DKIM keys generated!\nSelector: ${result.selector}\nPrivate key:\n${result.privateKey}`);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Domains</h1>

      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="example.com"
          required
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Add Domain
        </button>
      </form>

      <div className="space-y-3">
        {domains.map((domain) => (
          <div
            key={domain.id}
            className="bg-white p-4 rounded-lg border flex items-center justify-between"
          >
            <div>
              <p className="font-medium">{domain.name}</p>
              <p className="text-sm text-gray-500">
                DKIM: {domain.dkimSelector || "Not configured"}
              </p>
            </div>
            <div className="flex gap-2">
              {!domain.dkimSelector && (
                <button
                  onClick={() => handleGenerateDkim(domain.id)}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Generate DKIM
                </button>
              )}
              <button
                onClick={() => handleDelete(domain.id)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {domains.length === 0 && (
          <p className="text-gray-500 text-center py-8">No domains added yet</p>
        )}
      </div>
    </div>
  );
}
