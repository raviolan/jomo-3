export async function downloadJsonFile(payload: unknown, fileNameBase: string): Promise<void> {
  if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
    throw new Error("File export is only available in the web app.");
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = `${fileNameBase}.json`;
  link.rel = "noopener noreferrer";
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

export async function pickJsonFile(): Promise<{ fileName: string; text: string } | null> {
  if (typeof document === "undefined" || typeof window === "undefined") {
    throw new Error("File import is only available in the web app.");
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    let settled = false;

    input.accept = ".json,application/json";
    input.style.display = "none";
    input.type = "file";

    const cleanup = () => {
      input.removeEventListener("change", handleChange);
      window.removeEventListener("focus", handleFocus);
      input.remove();
    };

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    const handleFocus = () => {
      window.setTimeout(() => {
        if (!settled && !input.files?.length) {
          settle(() => resolve(null));
        }
      }, 0);
    };

    const handleChange = async () => {
      const file = input.files?.[0];

      if (!file) {
        settle(() => resolve(null));
        return;
      }

      try {
        const text = await file.text();
        settle(() =>
          resolve({
            fileName: file.name,
            text
          })
        );
      } catch {
        settle(() => reject(new Error("The selected file could not be read.")));
      }
    };

    document.body.appendChild(input);
    input.addEventListener("change", handleChange);
    window.addEventListener("focus", handleFocus);
    input.click();
  });
}
