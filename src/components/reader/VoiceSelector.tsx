'use client';

import { useCallback, useMemo } from 'react';

interface VoiceSelectorProps {
  voices: SpeechSynthesisVoice[];
  selectedVoiceURI: string | null;
  onVoiceChange: (uri: string) => void;
  onClose: () => void;
}

export function VoiceSelector({
  voices,
  selectedVoiceURI,
  onVoiceChange,
  onClose,
}: VoiceSelectorProps) {
  // Recommended voice name patterns — prioritize UK/AU male voices
  const RECOMMENDED_PATTERNS = [
    'daniel',     // UK male (macOS/iOS)
    'james',      // AU male (macOS/iOS)
    'google uk english male',   // Chrome
    'microsoft ryan',           // Edge — UK male
    'microsoft james',          // Edge — AU male
    'english (united kingdom)', // Android
    'english (australia)',       // Android
  ];

  const grouped = useMemo(() => {
    const recommended: SpeechSynthesisVoice[] = [];
    const local: SpeechSynthesisVoice[] = [];
    const network: SpeechSynthesisVoice[] = [];

    for (const v of voices) {
      const nameLower = v.name.toLowerCase();
      const isRecommended = RECOMMENDED_PATTERNS.some(p => nameLower.includes(p));

      if (isRecommended) {
        recommended.push(v);
      }
      if (v.localService) {
        local.push(v);
      } else {
        network.push(v);
      }
    }
    return { recommended, local, network };
  }, [voices]);

  const handlePreview = useCallback((voice: SpeechSynthesisVoice) => {
    if (typeof window === 'undefined') return;
    // Don't preview if speech is currently active (would cancel document playback)
    if (speechSynthesis.speaking || speechSynthesis.pending) return;
    const utterance = new SpeechSynthesisUtterance('Hello, this is a preview.');
    utterance.voice = voice;
    utterance.rate = 1;
    speechSynthesis.speak(utterance);
  }, []);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl bg-surface border border-border shadow-lg z-50 max-h-80 flex flex-col">
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <span className="text-sm font-medium text-foreground">Voice</span>
        <button
          type="button"
          onClick={onClose}
          className="h-11 w-11 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          aria-label="Close voice selector"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="overflow-y-auto px-4 pb-4 scroll-touch">
        {grouped.recommended.length > 0 && (
          <VoiceGroup
            label="Recommended"
            voices={grouped.recommended}
            selectedVoiceURI={selectedVoiceURI}
            onVoiceChange={onVoiceChange}
            onPreview={handlePreview}
          />
        )}
        {grouped.local.length > 0 && (
          <VoiceGroup
            label="Local Voices"
            voices={grouped.local}
            selectedVoiceURI={selectedVoiceURI}
            onVoiceChange={onVoiceChange}
            onPreview={handlePreview}
          />
        )}
        {grouped.network.length > 0 && (
          <VoiceGroup
            label="Network Voices"
            voices={grouped.network}
            selectedVoiceURI={selectedVoiceURI}
            onVoiceChange={onVoiceChange}
            onPreview={handlePreview}
          />
        )}
        {voices.length === 0 && (
          <p className="text-sm text-muted py-2">No voices available.</p>
        )}
      </div>
    </div>
  );
}

function VoiceGroup({
  label,
  voices,
  selectedVoiceURI,
  onVoiceChange,
  onPreview,
}: {
  label: string;
  voices: SpeechSynthesisVoice[];
  selectedVoiceURI: string | null;
  onVoiceChange: (uri: string) => void;
  onPreview: (voice: SpeechSynthesisVoice) => void;
}) {
  return (
    <div className="mb-3">
      <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
        {label}
      </h3>
      <div className="space-y-0.5">
        {voices.map((voice) => (
          <div
            key={voice.voiceURI}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors
              ${
                voice.voiceURI === selectedVoiceURI
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-surface-hover'
              }`}
            onClick={() => onVoiceChange(voice.voiceURI)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onVoiceChange(voice.voiceURI);
              }
            }}
          >
            <span className="flex-1 truncate">
              {voice.name}{' '}
              <span className="text-muted text-xs">({voice.lang})</span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(voice);
              }}
              className="h-11 w-11 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
              aria-label={`Preview ${voice.name}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
