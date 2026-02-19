import { useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Share2, Check, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateShareableLink, copyToClipboard } from '@/lib/shareUtils';
import type { Session } from '@/types';
import { useTheme } from '@/contexts';

interface ShareButtonProps {
  session: Session;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const ShareButton = ({
  session,
  variant = 'outline',
  size = 'default',
  className = '',
}: ShareButtonProps) => {
  const { isDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareLink, setShareLink] = useState('');

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    try {
      const link = await generateShareableLink(session);
      setShareLink(link);
      setIsOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate share link');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await copyToClipboard(shareLink);
      setCopied(true);
      toast.success('Link copied to clipboard!');

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleGenerateLink}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="mr-2 h-4 w-4" />
        )}
        Share
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className={
            isDarkMode
              ? 'bg-team-dark border-team-blue-40'
              : 'bg-white border-gray-200'
          }
        >
          <DialogHeader>
            <DialogTitle
              className={isDarkMode ? 'text-team-white' : 'text-gray-900'}
            >
              Share Session
            </DialogTitle>
            <DialogDescription
              className={isDarkMode ? 'text-team-white-60' : 'text-gray-600'}
            >
              Share this session analysis with anyone using the link below. No
              account required to view.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={shareLink}
                readOnly
                className={`flex-1 ${
                  isDarkMode
                    ? 'bg-team-dark-20 border-team-blue-40 text-team-white'
                    : 'bg-gray-50 border-gray-300'
                }`}
              />
              <Button
                onClick={handleCopyLink}
                variant="outline"
                className={
                  isDarkMode
                    ? 'border-team-blue-40 hover:bg-team-blue-10'
                    : 'border-gray-300'
                }
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            <div
              className={`text-xs p-3 rounded-lg ${
                isDarkMode
                  ? 'bg-team-blue-10 text-team-white-60'
                  : 'bg-blue-50 text-gray-600'
              }`}
            >
              💡 <strong>Tip:</strong> Anyone with this link can view the
              session analysis, even without an account.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
