export abstract class Entity<TId = string> {
  readonly id: TId;

  constructor(id?: TId) {
    this.id = id ?? (crypto.randomUUID() as unknown as TId);
  }

  equals(other: Entity<TId>): boolean {
    if (!(other instanceof Entity)) return false;
    return this.id === other.id;
  }
}
