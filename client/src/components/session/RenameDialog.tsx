import { useId, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { SESSION_LIMITS } from '@/constants';

/**
 * Renames a saved session: one field and Save, as the scoring page's session
 * menu does it. The dialog stays open while the name is saved, and if that
 * fails, with the name as typed.
 */
export const RenameDialog = ({
  name: currentName,
  onSave,
  onClose,
  isDarkMode,
}: {
  name: string;
  /** Save the new name; resolves to whether it was saved */
  onSave: (name: string) => Promise<boolean>;
  onClose: () => void;
  isDarkMode: boolean;
}) => {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const hasName = name.trim().length > 0;
  const nameId = useId();
  const errorId = useId();

  const save = async () => {
    if (!hasName || saving) return;
    const typed = name.trim();
    // Unchanged is nothing to save
    if (typed === currentName.trim()) {
      onClose();
      return;
    }
    setSaving(true);
    const saved = await onSave(typed);
    setSaving(false);
    if (saved) onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent
        className={`max-w-sm border p-6 ${
          isDarkMode
            ? 'bg-team-dark border-team-blue-40'
            : 'bg-white border-gray-200'
        }`}
      >
        <form
          noValidate
          onSubmit={e => {
            e.preventDefault();
            void save();
          }}
          className="space-y-4"
        >
          <DialogTitle className={isDarkMode ? 'text-white' : 'text-gray-900'}>
            Rename session
          </DialogTitle>
          <div className="space-y-2">
            <label
              htmlFor={nameId}
              className={`block ${EYEBROW_CLASS} ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Session name
            </label>
            <Input
              id={nameId}
              name="sessionName"
              type="text"
              autoComplete="off"
              data-autofocus
              maxLength={SESSION_LIMITS.MAX_SESSION_NAME_LENGTH}
              value={name}
              disabled={saving}
              onChange={e => setName(e.target.value)}
              onFocus={e => e.target.select()}
              aria-invalid={!hasName}
              aria-describedby={hasName ? undefined : errorId}
              className={`h-12 px-4 rounded-xl border-2 ${
                isDarkMode ? 'bg-team-dark text-white' : 'bg-white text-black'
              }`}
            />
            {!hasName && (
              <p
                id={errorId}
                role="alert"
                className={`text-xs font-medium ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}
              >
                Give the session a name
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="neutral"
              size="touch"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="touch"
              disabled={!hasName || saving}
              aria-busy={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
