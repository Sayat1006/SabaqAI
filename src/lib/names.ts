export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join("")
      .toUpperCase() || "?"
  );
}

/** «Айгерім Нұрланқызы» → Айгерім; «Айтбаев Саят» → Саят (тегі алдымен жазылса). */
export function firstNameOf(name: string): string {
  const words = name.trim().split(/\s+/);
  const surnameFirst = words.length > 1 && /(ов|ев|ова|ева|ин|ина)$/i.test(words[0]);
  return (surnameFirst ? words[1] : words[0]) ?? "";
}
