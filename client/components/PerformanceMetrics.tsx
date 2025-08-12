import { ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Modal } from "./ui/modal";
import { useSession } from "../contexts/SessionContext";

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

const MetricModal = ({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) => {
  const [samples, setSamples] = useState(0);
  const [specimen, setSpecimen] = useState(0);
  const [floorMark, setFloorMark] = useState(0);
  const [basket, setBasket] = useState(0);
  const [autonomousSpecimen, setAutonomousSpecimen] = useState(0);
  const [autonomousFloorMark, setAutonomousFloorMark] = useState(0);
  const [climb, setClimb] = useState(0);
  const [park, setPark] = useState(0);

  const handleIntegerChange = (
    value: string,
    setter: (value: number) => void,
  ) => {
    // Only allow integers (remove any non-digit characters)
    const integerValue = value.replace(/[^0-9]/g, "");
    setter(integerValue ? parseInt(integerValue) : 0);
  };

  const handleIncrement = (value: number, setter: (value: number) => void) => {
    setter(value + 1);
  };

  const handleDecrement = (value: number, setter: (value: number) => void) => {
    setter(Math.max(0, value - 1));
  };

  const ModalField = ({
    label,
    value,
    onChange,
    hasHButton = false,
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    hasHButton?: boolean;
  }) => (
    <div className="flex flex-col gap-2">
      <label className="text-white text-base">{label}</label>
      <div className="flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark">
        <input
          type="text"
          value={value}
          onChange={(e) => handleIntegerChange(e.target.value, onChange)}
          className="flex-1 bg-transparent text-white text-base font-light leading-6 focus:outline-none placeholder:text-team-white-40"
          placeholder="0"
        />
        <div className="flex items-center gap-1">
          {hasHButton && (
            <div className="flex items-center justify-center px-1 py-1 rounded">
              <span className="text-team-white-40 text-2xl font-medium leading-[18px]">
                H
              </span>
            </div>
          )}
          <div className="flex flex-col gap-0.5 p-0.5 rounded bg-team-white-10">
            <button
              onClick={() => handleIncrement(value, onChange)}
              className="flex items-center justify-center hover:bg-team-white-20 rounded transition-colors"
            >
              <ChevronUp className="w-2.5 h-2.5 text-team-white-40" />
            </button>
            <button
              onClick={() => handleDecrement(value, onChange)}
              className="flex items-center justify-center hover:bg-team-white-20 rounded transition-colors"
            >
              <ChevronDown className="w-2.5 h-2.5 text-team-white-40" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (title) {
      case "Autonomous Score":
        return (
          <div className="space-y-4">
            <ModalField
              label="Basket"
              value={basket}
              onChange={setBasket}
              hasHButton={true}
            />
            <ModalField
              label="Specimen"
              value={autonomousSpecimen}
              onChange={setAutonomousSpecimen}
              hasHButton={true}
            />
            <ModalField
              label="Floor Mark"
              value={autonomousFloorMark}
              onChange={setAutonomousFloorMark}
            />
          </div>
        );
      case "TeleOp Score":
        return (
          <div className="space-y-4">
            <ModalField label="Samples" value={samples} onChange={setSamples} />
            <ModalField
              label="Specimen"
              value={specimen}
              onChange={setSpecimen}
              hasHButton={true}
            />
            <ModalField
              label="Floor mark"
              value={floorMark}
              onChange={setFloorMark}
            />
          </div>
        );
      case "End Game Score":
        return (
          <div className="space-y-4">
            <ModalField label="Climb" value={climb} onChange={setClimb} />
            <ModalField label="Park" value={park} onChange={setPark} />
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
  const { sessionData, updateSessionData } = useSession();

  const setFinalScore = (value: number) => updateSessionData({ finalScore: value });
  const setAutonomousScore = (value: number) => updateSessionData({ autonomousScore: value });
  const setTeleOpScore = (value: number) => updateSessionData({ teleOpScore: value });
  const setEndGameScore = (value: number) => updateSessionData({ endGameScore: value });

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
            value={sessionData.finalScore}
            onChange={setFinalScore}
            hasDropdown={false}
          />
          <MetricField
            label="Autonomous Score"
            value={sessionData.autonomousScore}
            onChange={setAutonomousScore}
            onDropdownClick={() => openModal("Autonomous Score")}
          />
        </div>

        {/* Second Row */}
        <div className="flex flex-col gap-6">
          <MetricField
            label="TeleOp Score"
            value={sessionData.teleOpScore}
            onChange={setTeleOpScore}
            onDropdownClick={() => openModal("TeleOp Score")}
          />
        </div>

        {/* Third Row */}
        <div className="flex flex-col gap-6">
          <MetricField
            label="End Game Score"
            value={sessionData.endGameScore}
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
        {modalOpen && <MetricModal title={modalOpen} onClose={closeModal} />}
      </Modal>
    </div>
  );
};
