import { ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Modal } from "./ui/modal";

const MetricField = ({
  label,
  value,
  onChange,
  hasDropdown = true,
  onDropdownClick,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hasDropdown?: boolean;
  onDropdownClick?: () => void;
}) => {
  const handleIncrement = () => {
    onChange(value + 1);
  };

  const handleDecrement = () => {
    onChange(Math.max(0, value - 1)); // Prevent negative values
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/[^0-9]/g, "");
    onChange(numericValue ? parseInt(numericValue) : 0);
  };

  return (
    <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
      <div className="flex items-center gap-2">
        <label className="text-white text-base leading-6">{label}</label>
        {hasDropdown && (
          <button
            onClick={onDropdownClick}
            className="text-white hover:text-team-blue transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          className="flex-1 bg-transparent text-white text-base font-light leading-6 focus:outline-none placeholder:text-team-white-40"
          placeholder="0"
        />
        <div className="flex flex-col gap-0.5 p-0.5 rounded bg-team-white-10">
          <button
            onClick={handleIncrement}
            className="flex items-center justify-center hover:bg-team-white-20 rounded transition-colors"
          >
            <ChevronUp className="w-2.5 h-2.5 text-team-white-40" />
          </button>
          <button
            onClick={handleDecrement}
            className="flex items-center justify-center hover:bg-team-white-20 rounded transition-colors"
          >
            <ChevronDown className="w-2.5 h-2.5 text-team-white-40" />
          </button>
        </div>
      </div>
    </div>
  );
};

const MetricModal = ({ title, onClose }: { title: string; onClose: () => void }) => {
  const [samples, setSamples] = useState("");
  const [specimen, setSpecimen] = useState("");
  const [floorMark, setFloorMark] = useState("");
  const [preload, setPreload] = useState("");
  const [ascent, setAscent] = useState("");
  const [climb, setClimb] = useState("");
  const [park, setPark] = useState("");

  const handleIntegerChange = (value: string, setter: (value: string) => void) => {
    // Only allow integers (remove any non-digit characters)
    const integerValue = value.replace(/[^0-9]/g, "");
    setter(integerValue);
  };

  const renderContent = () => {
    switch (title) {
      case "Autonomous Score":
        return (
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-white text-base">Preload</label>
              <input
                type="text"
                value={preload}
                onChange={(e) => handleIntegerChange(e.target.value, setPreload)}
                className="px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark text-white text-base focus:outline-none focus:border-team-blue placeholder:text-team-white-40"
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-white text-base">Ascent</label>
              <input
                type="text"
                value={ascent}
                onChange={(e) => handleIntegerChange(e.target.value, setAscent)}
                className="px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark text-white text-base focus:outline-none focus:border-team-blue placeholder:text-team-white-40"
                placeholder="0"
              />
            </div>
          </div>
        );
      case "TeleOp Score":
        return (
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-white text-base">Samples</label>
              <input
                type="text"
                value={samples}
                onChange={(e) => handleIntegerChange(e.target.value, setSamples)}
                className="px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark text-white text-base focus:outline-none focus:border-team-blue placeholder:text-team-white-40"
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-white text-base">Specimen</label>
              <input
                type="text"
                value={specimen}
                onChange={(e) => handleIntegerChange(e.target.value, setSpecimen)}
                className="px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark text-white text-base focus:outline-none focus:border-team-blue placeholder:text-team-white-40"
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-white text-base">Floor mark</label>
              <input
                type="text"
                value={floorMark}
                onChange={(e) => handleIntegerChange(e.target.value, setFloorMark)}
                className="px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark text-white text-base focus:outline-none focus:border-team-blue placeholder:text-team-white-40"
                placeholder="0"
              />
            </div>
          </div>
        );
      case "End Game Score":
        return (
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-white text-base">Climb</label>
              <input
                type="text"
                value={climb}
                onChange={(e) => handleIntegerChange(e.target.value, setClimb)}
                className="px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark text-white text-base focus:outline-none focus:border-team-blue placeholder:text-team-white-40"
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-white text-base">Park</label>
              <input
                type="text"
                value={park}
                onChange={(e) => handleIntegerChange(e.target.value, setPark)}
                className="px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark text-white text-base focus:outline-none focus:border-team-blue placeholder:text-team-white-40"
                placeholder="0"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {renderContent()}
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded bg-team-white-10 text-white hover:bg-team-white-20 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded bg-team-blue text-team-dark hover:bg-team-blue/90 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export const PerformanceMetrics = () => {
  const [finalScore, setFinalScore] = useState(438);
  const [autonomousScore, setAutonomousScore] = useState(200);
  const [teleOpScore, setTeleOpScore] = useState(208);
  const [endGameScore, setEndGameScore] = useState(208);

  const [modalOpen, setModalOpen] = useState<string | null>(null);

  const openModal = (metricType: string) => {
    setModalOpen(metricType);
  };

  const closeModal = () => {
    setModalOpen(null);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">
        Performance Metrics
      </h2>

      <div className="space-y-6">
        {/* First Row */}
        <div className="flex flex-col gap-6">
          <MetricField
            label="Final Score"
            value={finalScore}
            onChange={setFinalScore}
            hasDropdown={false}
          />
          <MetricField
            label="Autonomous Score"
            value={autonomousScore}
            onChange={setAutonomousScore}
            onDropdownClick={() => openModal("Autonomous Score")}
          />
        </div>

        {/* Second Row */}
        <div className="flex flex-col gap-6">
          <MetricField
            label="TeleOp Score"
            value={teleOpScore}
            onChange={setTeleOpScore}
            onDropdownClick={() => openModal("TeleOp Score")}
          />
        </div>

        {/* Third Row */}
        <div className="flex flex-col gap-6">
          <MetricField
            label="End Game Score"
            value={endGameScore}
            onChange={setEndGameScore}
            onDropdownClick={() => openModal("End Game Score")}
          />
        </div>
      </div>

      {/* Modals */}
      <Modal
        isOpen={modalOpen !== null}
        onClose={closeModal}
        title={modalOpen || ""}
      >
        {modalOpen && (
          <MetricModal title={modalOpen} onClose={closeModal} />
        )}
      </Modal>
    </div>
  );
};
