import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Search, Loader2 } from 'lucide-react';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

// Mock GIFs for demo - in production you'd use GIPHY/Tenor API
const mockGifs = [
  'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif',
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
  'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif',
  'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
  'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/giphy.gif',
  'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif',
  'https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif',
  'https://media.giphy.com/media/xUA7bdpLxQhsSQdyog/giphy.gif',
  'https://media.giphy.com/media/3o7abB06u9bNzA8lu8/giphy.gif',
  'https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif',
  'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif',
];

const trendingCategories = ['Trending', 'Reactions', 'Gaming', 'Love', 'Party', 'Animals'];

const GifPicker = ({ onSelect, onClose }: GifPickerProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Trending');

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => setIsLoading(false), 500);
  };

  return (
    <div className="absolute bottom-20 left-4 w-96 h-[450px] glass-card rounded-2xl overflow-hidden animate-scale-in z-50">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎬</span>
          <h3 className="font-display text-sm font-semibold text-foreground">GIFs</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="w-7 h-7">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search GIFs..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-1 p-2 border-b border-border overflow-x-auto scrollbar-neon">
        {trendingCategories.map((category) => (
          <Button
            key={category}
            variant={activeCategory === category ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveCategory(category)}
            className="text-xs whitespace-nowrap"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* GIFs Grid */}
      <div className="p-2 overflow-y-auto h-[300px] scrollbar-neon">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {mockGifs.map((gif, index) => (
              <button
                key={index}
                onClick={() => onSelect(gif)}
                className="relative aspect-video rounded-xl overflow-hidden group hover:ring-2 hover:ring-primary transition-all"
              >
                <img
                  src={gif}
                  alt={`GIF ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border text-center">
        <span className="text-xs text-muted-foreground">Powered by GIPHY</span>
      </div>
    </div>
  );
};

export default GifPicker;
