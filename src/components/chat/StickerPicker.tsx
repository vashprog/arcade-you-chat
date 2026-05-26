import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface StickerPickerProps {
  onSelect: (stickerUrl: string) => void;
  onClose: () => void;
}

// Mock sticker packs
const stickerPacks = {
  'Neon Vibes': [
    '✨', '💫', '🌟', '⭐', '🔥', '💥', '⚡', '🌈',
  ],
  'Cool Cats': [
    '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
  ],
  'Love': [
    '💕', '💗', '💓', '💖', '💘', '💝', '💞', '💟',
  ],
  'Reactions': [
    '👍', '👎', '👏', '🙌', '🤝', '💪', '🙏', '✌️',
  ],
};

// Mock animated sticker URLs (using emojis as placeholders)
const animatedStickers = [
  'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif',
  'https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif',
  'https://media.giphy.com/media/3o7abB06u9bNzA8lu8/giphy.gif',
  'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif',
  'https://media.giphy.com/media/xUA7bdpLxQhsSQdyog/giphy.gif',
  'https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif',
];

const StickerPicker = ({ onSelect, onClose }: StickerPickerProps) => {
  const [activePack, setActivePack] = useState('Neon Vibes');

  return (
    <div className="absolute bottom-20 left-4 w-80 h-96 glass-card rounded-2xl overflow-hidden animate-scale-in z-50">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎨</span>
          <h3 className="font-display text-sm font-semibold text-foreground">Stickers</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="w-7 h-7">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Sticker Packs */}
      <div className="flex gap-1 p-2 border-b border-border overflow-x-auto scrollbar-neon">
        {Object.keys(stickerPacks).map((pack) => (
          <Button
            key={pack}
            variant={activePack === pack ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActivePack(pack)}
            className="text-xs whitespace-nowrap"
          >
            {pack}
          </Button>
        ))}
      </div>

      {/* Stickers Grid */}
      <div className="p-3 overflow-y-auto h-64 scrollbar-neon">
        {/* Emoji Stickers */}
        <div className="mb-4">
          <h4 className="text-xs text-muted-foreground mb-2 font-body">Static Stickers</h4>
          <div className="grid grid-cols-4 gap-2">
            {stickerPacks[activePack as keyof typeof stickerPacks].map((sticker, index) => (
              <button
                key={index}
                onClick={() => onSelect(sticker)}
                className="w-14 h-14 flex items-center justify-center text-3xl bg-card/50 hover:bg-primary/20 rounded-xl transition-all hover:scale-110"
              >
                {sticker}
              </button>
            ))}
          </div>
        </div>

        {/* Animated Stickers */}
        <div>
          <h4 className="text-xs text-muted-foreground mb-2 font-body">Animated Stickers</h4>
          <div className="grid grid-cols-3 gap-2">
            {animatedStickers.map((sticker, index) => (
              <button
                key={index}
                onClick={() => onSelect(sticker)}
                className="aspect-square rounded-xl overflow-hidden hover:ring-2 hover:ring-primary transition-all hover:scale-105"
              >
                <img
                  src={sticker}
                  alt={`Sticker ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickerPicker;
