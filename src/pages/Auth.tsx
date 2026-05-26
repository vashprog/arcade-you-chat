import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Phone, Gamepad2, Video, ArrowLeft } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/chat');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (isLogin) {
      await signIn(email, password);
    } else {
      await signUp(email, password, username);
    }

    setIsSubmitting(false);
  };

  const features = [
    { icon: MessageSquare, color: 'text-primary' },
    { icon: Phone, color: 'text-secondary' },
    { icon: Gamepad2, color: 'text-accent' },
    { icon: Video, color: 'text-neon-green' },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-cyber-grid bg-cyber-grid opacity-20" />
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-secondary/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/10 rounded-full blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-3 mb-4">
            <h1 className="font-display text-4xl font-bold gradient-text">
              ArcadeUChat
            </h1>
          </div>
          <p className="text-muted-foreground font-body text-lg">
            Communication Beyond Chat
          </p>
        </div>

        {/* Features Preview */}
        <div className="flex justify-center gap-6 mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {features.map((feature, index) => (
            <div
              key={feature.label}
              className="flex flex-col items-center gap-2 group"
              style={{ animationDelay: `${0.2 + index * 0.1}s` }}
            >
              <div className={`p-3 rounded-xl bg-card/50 backdrop-blur-sm border border-primary/20 group-hover:border-primary/50 transition-all duration-300 group-hover:scale-110 ${feature.color}`}>
                <feature.icon className="w-5 h-5" />
              </div>
              <span className="text-xs text-muted-foreground font-body">{feature.label}</span>
            </div>
          ))}
        </div>

        {/* Auth Card */}
        <div className="glass-card rounded-2xl p-8 animate-scale-in" style={{ animationDelay: '0.3s' }}>
          {/* Tab Switcher */}
          <div className="flex mb-8 bg-muted/50 rounded-lg p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 px-4 rounded-md font-body font-semibold transition-all duration-300 ${
                isLogin
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 px-4 rounded-md font-body font-semibold transition-all duration-300 ${
                !isLogin
                  ? 'bg-secondary text-secondary-foreground shadow-lg shadow-secondary/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2 animate-fade-in-up">
                <Label htmlFor="username" className="text-foreground font-body">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Choose a cool username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-body">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-body">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              variant="neon"
              size="lg"
              className="w-full mt-6"
              disabled={isSubmitting || loading}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {isLogin ? 'Logging in...' : 'Creating account...'}
                </div>
              ) : (
                <>{isLogin ? 'Enter the Matrix' : 'Join the Network'}</>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6 font-body">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:text-primary/80 font-semibold transition-colors"
            >
              {isLogin ? 'Sign up' : 'Login'}
            </button>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6 font-body animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
};

export default Auth;
