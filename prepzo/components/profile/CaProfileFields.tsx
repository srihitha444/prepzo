"use client";

export const CA_LEVELS = ["Foundation", "Intermediate", "Final"] as const;
export const CA_GROUP_NAMES = ["Group 1", "Group 2"] as const;

interface CaProfileFieldsProps {
  caLevel: string;
  caGroups: string[];
  targetDate: string;
  onLevelChange: (level: string) => void;
  onGroupsChange: (groups: string[]) => void;
  onTargetDateChange: (date: string) => void;
}

export function CaProfileFields({
  caLevel,
  caGroups,
  targetDate,
  onLevelChange,
  onGroupsChange,
  onTargetDateChange,
}: CaProfileFieldsProps) {
  const showGroups = caLevel === "Intermediate" || caLevel === "Final";

  function toggleGroup(group: string) {
    if (caGroups.includes(group)) {
      onGroupsChange(caGroups.filter((g) => g !== group));
      return;
    }
    onGroupsChange([...caGroups, group]);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-[#0F172A]">Which CA level are you preparing for?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {CA_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onLevelChange(level)}
              className={`min-h-[46px] rounded-xl border-2 px-3 text-sm font-semibold transition-all ${
                caLevel === level
                  ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                  : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF] hover:text-[#1E3A8A]"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {showGroups && (
        <div>
          <p className="mb-3 text-sm font-semibold text-[#0F172A]">Which group(s)?</p>
          <div className="flex flex-wrap gap-2">
            {CA_GROUP_NAMES.map((group) => {
              const selected = caGroups.includes(group);
              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold transition-all ${
                    selected
                      ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                      : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#3B5FBF] hover:text-[#1E3A8A]"
                  }`}
                >
                  {group}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="mb-3 block text-sm font-semibold text-[#0F172A]" htmlFor="ca-target-date">
          Target attempt date
        </label>
        <input
          id="ca-target-date"
          type="date"
          value={targetDate}
          onChange={(e) => onTargetDateChange(e.target.value)}
          className="w-full rounded-xl border-2 border-[#E2E8F0] px-4 py-3 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
        />
      </div>
    </div>
  );
}
