import { useSession } from "../contexts/SessionContext";
import { useTheme } from "../contexts/ThemeContext";

const FormField = ({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "decimal";
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (type === "number") {
      // Only allow numbers
      const numericValue = e.target.value.replace(/[^0-9]/g, "");
      onChange(numericValue);
    } else if (type === "decimal") {
      // Allow numbers and one decimal point
      const decimalValue = e.target.value.replace(/[^0-9.]/g, "");
      // Ensure only one decimal point
      const parts = decimalValue.split(".");
      if (parts.length > 2) {
        // If more than one decimal point, keep only the first one
        onChange(parts[0] + "." + parts.slice(1).join(""));
      } else {
        onChange(decimalValue);
      }
    } else {
      onChange(e.target.value);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
      <label className="text-white text-base leading-6">{label}</label>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark text-white text-base font-normal leading-6 focus:outline-none focus:border-team-blue focus:ring-1 focus:ring-team-blue placeholder:text-team-white-40"
      />
    </div>
  );
};

export const SessionSetup = () => {
  const { sessionData, updateSessionData } = useSession();

  const setSessionName = (value: string) => updateSessionData({ sessionName: value });
  const setDriverName = (value: string) => updateSessionData({ driverName: value });
  const setSessionDuration = (value: string) => updateSessionData({ sessionDuration: value });
  const setMatchType = (value: string) => updateSessionData({ matchType: value });

  return (
    <div className="space-y-8">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">
        Session Setup
      </h2>

      <div className="space-y-6">
        {/* First Row */}
        <div className="flex flex-col sm:flex-row gap-6">
          <FormField
            label="Session Name"
            placeholder="ex. practice"
            value={sessionData.sessionName}
            onChange={setSessionName}
          />
          <FormField
            label="Driver Name"
            placeholder="Ethan Yang"
            value={sessionData.driverName}
            onChange={setDriverName}
          />
        </div>

        {/* Second Row */}
        <div className="flex flex-col sm:flex-row gap-6">
          <FormField
            label="Session Duration"
            placeholder="minutes"
            value={sessionData.sessionDuration}
            onChange={setSessionDuration}
            type="decimal"
          />
          <FormField
            label="Match Type"
            placeholder="Autonomous"
            value={sessionData.matchType}
            onChange={setMatchType}
          />
        </div>
      </div>
    </div>
  );
};
