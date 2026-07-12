// components/thesis/ArgumentPicker.tsx
"use client";

import React, { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ArgumentRole = "PREMISE" | "INFERENCE" | "COUNTER_RESPONSE";

export function ArgumentPicker({
  deliberationId,
  onSelect,
}: {
  deliberationId: string;
  onSelect: (argumentId: string, role: ArgumentRole) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<ArgumentRole>("PREMISE");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useSWR(
    `/api/arguments?deliberationId=${deliberationId}`,
    fetcher
  );

  const argumentsList = data?.arguments ?? [];

  const filteredArguments = argumentsList.filter((arg: any) =>
    arg.text?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Role Selector */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Argument Role
        </label>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as ArgumentRole)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        >
          <option value="PREMISE">Premise (supporting evidence)</option>
          <option value="INFERENCE">Inference (reasoning step)</option>
          <option value="COUNTER_RESPONSE">Counter-Response (addressing objections)</option>
        </select>
      </div>

      {/* Search */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Search Arguments
        </label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          placeholder="Search by text..."
        />
      </div>

      {/* Arguments List */}
      <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin w-6 h-6 border-4 border-cyan-600 border-t-transparent rounded-full" />
          </div>
        ) : filteredArguments.length === 0 ? (
          <div className="text-sm text-slate-500 text-center p-8">
            {searchQuery ? "No matching arguments found" : "No arguments available"}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredArguments.map((arg: any) => (
              <button
                key={arg.id}
                onClick={() => onSelect(arg.id, selectedRole)}
                className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="text-sm text-slate-700">{arg.text}</div>
                {arg.scheme && (
                  <div className="mt-1 text-xs text-slate-500">
                    Scheme: {arg.scheme.name}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
