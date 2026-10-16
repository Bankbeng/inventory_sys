export function withoutPassword<T extends { password: string }>(
  staff: T,
): Omit<T, "password"> {
  const { password, ...safeStaff } = staff;
  void password;
  return safeStaff;
}
