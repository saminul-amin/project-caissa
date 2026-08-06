export { GameShellPage, ActiveGameShell } from "./GameShellPage";
export { ChessBoardAdapter, type ChessBoardAdapterProps } from "./components/ChessBoardAdapter";
export { KeyboardChessBoard } from "./components/KeyboardChessBoard";
export { PromotionDialog } from "./components/PromotionDialog";
export {
  createSourceSelection,
  moveFeedbackMessage,
  projectBoardSelection,
  type BoardInputMethod,
  type BoardInteractionState,
  type BoardMoveIntent,
  type BoardSelectionProjection,
  type MoveFeedbackMessageKey,
} from "./board-interaction";
export {
  getGameInteractionEligibility,
  useActiveGameInteraction,
  type ActiveGameInteraction,
  type GameInteractionEligibility,
} from "./use-active-game-interaction";
export {
  createMoveHistoryRows,
  createPlayerPanelModel,
  gameStatusLabel,
  resultLabel,
  timeControlLabel,
  type MoveHistoryRow,
  type PlayerPanelModel,
} from "./game-shell-projections";
export {
  createPiecePositionSummary,
  findKingSquare,
  type AccessiblePiecePosition,
} from "./position-summary";
