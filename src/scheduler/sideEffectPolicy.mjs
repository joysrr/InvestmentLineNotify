export function shouldWriteSheet({ isSheetEnabled = true } = {}) {
  return isSheetEnabled;
}

export function shouldRunAi({ isCallAI = true } = {}) {
  return isCallAI;
}

// ponytail: keep side-effect gates explicit until a full run profile exists.
