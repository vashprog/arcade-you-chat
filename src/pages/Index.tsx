import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MessageSquare, Video, Gamepad2, ArrowRight, Shield, Phone } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/chat');
    }
  }, [user, loading, navigate]);

  const features = [
    {
      icon: MessageSquare,
      title: 'Real-time Messaging',
      description: 'Send texts, emojis, GIFs, stickers, voice notes, photos, videos, and files instantly.',
      color: 'text-primary',
      glow: 'shadow-primary/30',
    },
    {
      icon: Phone,
      title: 'Audio & Video Calls',
      description: 'HD voice and video calls with live environments and shared experiences.',
      color: 'text-secondary',
      glow: 'shadow-secondary/30',
    },
    {
      icon: Gamepad2,
      title: 'Social Arcade',
      description: 'Play trivia, challenges, cards, party games, co-op activities, and mini experiences directly inside chat.',
      color: 'text-accent',
      glow: 'shadow-accent/30',
    },
    {
      icon: Video,
      title: 'Shared Moments',
      description: 'Share voice clips, short videos, memories, reactions, and spontaneous updates in real time.',
      color: 'text-neon-green',
      glow: 'shadow-neon-green/30',
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-cyber-grid bg-cyber-grid opacity-20" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[150px] animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[200px]" />

      {/* Header */}
      <header className="relative z-10 px-6 py-4">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-bold gradient-text">ArcadeUChat</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/auth')}>
              Login
            </Button>
            <Button variant="neon" onClick={() => navigate('/auth')}>
              Get Started
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10">
        <section className="px-6 py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in-up">
              <span className="text-sm font-body text-primary">A cozy little space</span>
            </div>

            <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <span className="text-foreground">More Than</span>
              <br />
              <span className="gradient-text">Messaging</span>
            </h1>

            <p className="text-xl text-muted-foreground font-body max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Messaging, immersive calls, shared games, virtual spaces, and real-time experiences — all in one platform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Button variant="neon" size="lg" onClick={() => navigate('/auth')} className="min-w-[200px]">
                Join Now
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="flex items-center justify-center gap-8 mt-12 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-5 h-5 text-neon-green" />
                <span className="text-sm font-body">Private & Secure</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Gamepad2 className="w-5 h-5 text-primary" />
                <span className="text-sm font-body">Built-In Social Games</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-6 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
                Communication Beyond Chat
              </h2>
              <p className="text-muted-foreground font-body text-lg">
                Everything you need to communicate, play, and connect in one reactive platform.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`p-8 rounded-2xl glass-card hover:scale-[1.02] transition-all duration-300 animate-fade-in-up shadow-lg ${feature.glow}`}
                  style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br from-card to-muted flex items-center justify-center mb-6 ${feature.color}`}>
                    <feature.icon className="w-7 h-7" />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground font-body">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <div className="p-12 rounded-3xl bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 border border-primary/20">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
                Let's Arcade you up
              </h2>
              <p className="text-muted-foreground font-body text-lg mb-8 max-w-xl mx-auto">
                Create your account and start chatting, calling, gaming, and sharing experiences in seconds.
              </p>
              <Button variant="neon" size="lg" onClick={() => navigate('/auth')} className="min-w-[250px]">
                Join ArcadeUChat
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm text-foreground">ArcadeUChat</span>
          </div>
          <p className="text-sm text-muted-foreground font-body">
            © 2026 ArcadeUChat. Communication beyond chat.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
