import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Trophy, Users, Clock, Check, X, Crown, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { TriviaGameState, TriviaPlayer } from '@/hooks/useTriviaGame';
import { Progress } from '@/components/ui/progress';

interface TriviaGameProps {
  triviaState: TriviaGameState | null;
  lobbyCountdown: number | null;
  onSubmitAnswer: (answer: string) => Promise<void>;
  onNextQuestion: () => Promise<void>;
  onEndGame: () => Promise<void>;
  onStartGame: () => Promise<void>;
  isHost: boolean;
}

const TriviaGame = ({
  triviaState,
  lobbyCountdown,
  onSubmitAnswer,
  onNextQuestion,
  onEndGame,
  onStartGame,
  isHost,
}: TriviaGameProps) => {
  const { user } = useAuth();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);

  // Reset answer state when question changes
  useEffect(() => {
    setSelectedAnswer(null);
    setHasAnswered(false);
  }, [triviaState?.questionIndex]);

  // Check if user has already answered this question
  useEffect(() => {
    if (user && triviaState?.answers?.[user.id]) {
      setHasAnswered(true);
      setSelectedAnswer(triviaState.answers[user.id].answer);
    }
  }, [triviaState?.answers, user]);

  if (!triviaState) {
    return (
      <div className="text-center py-8 sm:py-12">
        <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm sm:text-base">Loading game...</p>
      </div>
    );
  }

  const joinedPlayers = triviaState.players.filter((p) => p.status === 'joined');
  const pendingPlayers = triviaState.players.filter((p) => p.status === 'pending');

  // Lobby view - waiting for players
  if (!triviaState.gameStarted) {
    return (
      <div className="text-center px-2">
        <h2 className="font-display text-2xl sm:text-3xl mb-2 gradient-text">Trivia Challenge 🧠</h2>
        <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">Waiting for players to join...</p>

        {/* Countdown */}
        {lobbyCountdown !== null && lobbyCountdown > 0 && (
          <div className="mb-4 sm:mb-6">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="font-display text-primary text-sm sm:text-base">Starting in {lobbyCountdown}s</span>
            </div>
          </div>
        )}

        {/* Players list */}
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span className="font-display text-base sm:text-lg">Players ({joinedPlayers.length})</span>
          </div>

          <div className="space-y-2 sm:space-y-3 max-h-[200px] overflow-y-auto scrollbar-neon">
            {triviaState.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-2 sm:p-3 rounded-xl ${
                  player.status === 'joined'
                    ? 'bg-neon-green/10 border border-neon-green/30'
                    : player.status === 'left'
                    ? 'bg-destructive/10 border border-destructive/30'
                    : 'bg-muted/50 border border-border'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {player.id === triviaState.hostId && (
                    <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500 shrink-0" />
                  )}
                  <span className="font-body text-sm sm:text-base truncate">{player.username}</span>
                </div>
                <span
                  className={`text-xs sm:text-sm shrink-0 ml-2 ${
                    player.status === 'joined'
                      ? 'text-neon-green'
                      : player.status === 'left'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                >
                  {player.status === 'joined' ? '✓ Joined' : player.status === 'left' ? '✗ Left' : 'Waiting...'}
                </span>
              </div>
            ))}
          </div>

          {pendingPlayers.length > 0 && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4">
              Waiting for {pendingPlayers.length} more player(s)...
            </p>
          )}
        </div>

        {/* Start/Cancel buttons */}
        <div className="flex gap-2 sm:gap-3 justify-center flex-wrap">
          {isHost && joinedPlayers.length >= 2 && (
            <Button variant="neon" onClick={onStartGame} size="sm" className="sm:text-base">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Start ({joinedPlayers.length} players)
            </Button>
          )}
          <Button variant="outline" onClick={onEndGame} size="sm" className="sm:text-base">
            Cancel
          </Button>
        </div>

        {joinedPlayers.length < 2 && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4">Need at least 2 players to start</p>
        )}
      </div>
    );
  }

  // Game ended - show final results
  if (triviaState.gameEnded) {
    const sortedPlayers = [...triviaState.players]
      .filter((p) => p.status === 'joined')
      .sort((a, b) => b.score - a.score);

    const winner = sortedPlayers[0];

    return (
      <div className="text-center px-2">
        <h2 className="font-display text-2xl sm:text-3xl mb-2 gradient-text">Game Over! 🎉</h2>

        {/* Winner announcement */}
        <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl border border-yellow-500/30 p-4 sm:p-6 mb-4 sm:mb-6">
          <Trophy className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-yellow-500" />
          <p className="text-xl sm:text-2xl font-display text-yellow-500 mb-1 sm:mb-2">{winner.username} Wins!</p>
          <p className="text-muted-foreground text-sm sm:text-base">with {winner.score} correct answers</p>
        </div>

        {/* Final scoreboard */}
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
          <h3 className="font-display text-base sm:text-lg mb-3 sm:mb-4">Final Scores</h3>
          <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-neon">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-2 sm:p-3 rounded-xl ${
                  index === 0 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted flex items-center justify-center text-xs sm:text-sm font-bold shrink-0">
                    {index + 1}
                  </span>
                  <span className="font-body text-sm sm:text-base truncate">{player.username}</span>
                  {player.id === user?.id && (
                    <span className="text-[10px] sm:text-xs text-muted-foreground">(You)</span>
                  )}
                </div>
                <span className="font-bold text-primary text-sm sm:text-base shrink-0 ml-2">{player.score}/{triviaState.totalQuestions}</span>
              </div>
            ))}
          </div>
        </div>

        <Button variant="neon" onClick={onEndGame} size="sm" className="sm:text-base">
          Back to Games
        </Button>
      </div>
    );
  }

  // Active game - question view
  const currentQuestion = triviaState.currentQuestion;
  const progress = ((triviaState.questionIndex + 1) / triviaState.totalQuestions) * 100;
  const answeredCount = Object.keys(triviaState.answers).length;

  const handleSelectAnswer = async (answer: string) => {
    if (hasAnswered) return;
    setSelectedAnswer(answer);
    setHasAnswered(true);
    await onSubmitAnswer(answer);
  };

  return (
    <div className="text-center px-2">
      <h2 className="font-display text-xl sm:text-2xl mb-2 gradient-text">Trivia Challenge 🧠</h2>

      {/* Progress and scores */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
        <span className="text-xs sm:text-sm text-muted-foreground shrink-0">
          Q{triviaState.questionIndex + 1}/{triviaState.totalQuestions}
        </span>
        <div className="flex gap-1 sm:gap-2 flex-wrap justify-end">
          {joinedPlayers.slice(0, 3).map((player) => (
            <div
              key={player.id}
              className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
                player.id === user?.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              {player.username.slice(0, 6)}: {player.score}
            </div>
          ))}
          {joinedPlayers.length > 3 && (
            <div className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              +{joinedPlayers.length - 3}
            </div>
          )}
        </div>
      </div>

      <Progress value={progress} className="mb-4 sm:mb-6 h-1.5 sm:h-2" />

      {/* Question */}
      {currentQuestion && (
        <div className="bg-card rounded-2xl border border-border p-3 sm:p-6 mb-4 sm:mb-6">
          <div className="text-[10px] sm:text-xs text-muted-foreground mb-2">{currentQuestion.category}</div>
          <p className="text-base sm:text-xl font-body text-foreground mb-4 sm:mb-6">{currentQuestion.question}</p>

          {/* Showing results after everyone answered */}
          {triviaState.showingResults ? (
            <div className="space-y-2 sm:space-y-3">
              {currentQuestion.options.map((option) => {
                const isCorrect = option === currentQuestion.correctAnswer;
                const myAnswer = triviaState.answers[user?.id || '']?.answer;
                const isMyAnswer = option === myAnswer;

                return (
                  <div
                    key={option}
                    className={`p-2.5 sm:p-4 rounded-xl border-2 flex items-center justify-between ${
                      isCorrect
                        ? 'border-neon-green bg-neon-green/10'
                        : isMyAnswer
                        ? 'border-destructive bg-destructive/10'
                        : 'border-border'
                    }`}
                  >
                    <span className="font-body text-sm sm:text-base text-left">{option}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {isCorrect && <Check className="w-4 h-4 sm:w-5 sm:h-5 text-neon-green" />}
                      {isMyAnswer && !isCorrect && <X className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />}
                    </div>
                  </div>
                );
              })}

              {/* Show who answered what */}
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border">
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">Answers:</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
                  {Object.entries(triviaState.answers).map(([playerId, answerData]) => {
                    const player = triviaState.players.find((p) => p.id === playerId);
                    return (
                      <div
                        key={playerId}
                        className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
                          answerData.correct ? 'bg-neon-green/20 text-neon-green' : 'bg-destructive/20 text-destructive'
                        }`}
                      >
                        {player?.username.slice(0, 8)}: {answerData.correct ? '✓' : '✗'}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Next question button (host only) */}
              {isHost && (
                <Button variant="neon" className="mt-3 sm:mt-4" onClick={onNextQuestion} size="sm">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  {triviaState.questionIndex + 1 >= triviaState.totalQuestions ? 'See Results' : 'Next Question'}
                </Button>
              )}
            </div>
          ) : (
            /* Answer options */
            <div className="space-y-2 sm:space-y-3">
              {currentQuestion.options.map((option) => (
                <Button
                  key={option}
                  variant="outline"
                  className={`w-full justify-start min-h-[44px] sm:min-h-[50px] text-left text-sm sm:text-base ${
                    selectedAnswer === option
                      ? 'border-primary bg-primary/10'
                      : hasAnswered
                      ? 'opacity-50'
                      : 'hover:border-primary hover:bg-primary/10'
                  }`}
                  onClick={() => handleSelectAnswer(option)}
                  disabled={hasAnswered}
                >
                  {option}
                </Button>
              ))}

              {/* Waiting indicator */}
              {hasAnswered && (
                <div className="flex items-center justify-center gap-2 mt-3 sm:mt-4 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                  <span className="text-xs sm:text-sm">
                    Waiting... ({answeredCount}/{joinedPlayers.length})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* End game button */}
      <Button variant="ghost" className="text-muted-foreground text-xs sm:text-sm" onClick={onEndGame} size="sm">
        Leave Game
      </Button>
    </div>
  );
};

export default TriviaGame;
