import { IS_STAGE } from './live/page';
import { StageFrame } from './live/StageFrame';
import { Dashboard } from './live/Dashboard';
import { useGame } from './game/useGame';
import { GameStage } from './game/GameStage';
import { GameControls } from './game/GameControls';

export default function App() {
  const game = useGame();

  // Page for TikTok LIVE Studio: only the game screen
  if (IS_STAGE) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <StageFrame>
          <GameStage game={game} />
        </StageFrame>
      </div>
    );
  }

  // Control page
  return (
    <Dashboard
      status={game.status}
      channelName={game.channelName}
      extra={<GameControls view={game.view} stageCount={game.stageCount} />}
      preview={
        <StageFrame maxHeight={720}>
          <GameStage game={game} />
        </StageFrame>
      }
    />
  );
}
