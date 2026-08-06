export { GameShellPage, ActiveGameShell } from "./GameShellPage";
export { ChessBoardAdapter, type ReadOnlyChessBoardProps } from "./components/ChessBoardAdapter";
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
