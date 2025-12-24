export function createPersistence({
  state,
  setLocal,
  setGlobalStatus,
  storageErrorToUserMessage,
  KEY_CUSTOM_TEMPLATES,
  KEY_TEMPLATE_OVERRIDES
}) {
  async function persistCustomTemplatesRaw() {
    await setLocal({ [KEY_CUSTOM_TEMPLATES]: state.customTemplates });
  }

  async function persistOverridesRaw() {
    const obj = Object.fromEntries(state.overrides.entries());
    await setLocal({ [KEY_TEMPLATE_OVERRIDES]: obj });
  }

  async function persistCustomTemplates(action = "저장") {
    try {
      await persistCustomTemplatesRaw();
      return true;
    } catch (e) {
      console.error("persistCustomTemplates failed:", e);
      setGlobalStatus(storageErrorToUserMessage(e, action));
      return false;
    }
  }

  async function persistOverrides(action = "저장") {
    try {
      await persistOverridesRaw();
      return true;
    } catch (e) {
      console.error("persistOverrides failed:", e);
      setGlobalStatus(storageErrorToUserMessage(e, action));
      return false;
    }
  }

  async function persistAll(action = "저장") {
    try {
      await persistOverridesRaw();
      await persistCustomTemplatesRaw();
      return true;
    } catch (e) {
      console.error("persistAll failed:", e);
      setGlobalStatus(storageErrorToUserMessage(e, action));
      return false;
    }
  }

  return {
    persistCustomTemplatesRaw,
    persistOverridesRaw,
    persistCustomTemplates,
    persistOverrides,
    persistAll
  };
}

