export function normalizeContactName(input: string): {
  displayName: string;
  searchName: string;
} {
  const collapsed = input.trim().replace(/\s+/g, " ");
  if (!collapsed) {
    throw new Error("Name is required.");
  }

  const displayName = collapsed
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

  return {
    displayName,
    searchName: displayName.toLowerCase()
  };
}
