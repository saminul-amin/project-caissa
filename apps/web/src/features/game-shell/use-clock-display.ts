import { useEffect, useState } from "react";
import type { ClockDisplay, ClockState } from "@caissa/chess-core";

import type { ActiveGameRuntimeView } from "../../app/CaissaAppProvider";

export function useClockDisplay(activeGame: ActiveGameRuntimeView): ClockDisplay {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (activeGame.session.clock.status !== "running") return;
    const interval = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 200);
    return () => {
      window.clearInterval(interval);
    };
  }, [activeGame]);

  return project(activeGame);
}

function project(activeGame: ActiveGameRuntimeView): ClockDisplay {
  const result = activeGame.projectClock();
  return result.status === "projected" ? result.display : storedDisplay(result.state);
}

function storedDisplay(state: ClockState): ClockDisplay {
  if (state.status === "untimed") {
    return {
      activeColor: undefined,
      blackRemainingMs: undefined,
      expiredColor: undefined,
      status: "untimed",
      whiteRemainingMs: undefined,
    };
  }
  return {
    activeColor: state.status === "running" ? state.activeColor : undefined,
    blackRemainingMs: state.remaining.black,
    expiredColor: state.status === "expired" ? state.expiredColor : undefined,
    status: state.status,
    whiteRemainingMs: state.remaining.white,
  };
}
